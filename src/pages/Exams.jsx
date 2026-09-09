import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { Field, Input, Select } from '../components/common/Field.jsx'
import DataTable from '../components/tables/DataTable.jsx'
import { useExams, useExamClassrooms } from '../hooks/useExams.js'
import { useDuties, useClassrooms } from '../hooks/useDuties.js'
import { useTeachers } from '../hooks/useTeachers.js'
import { upsertExam, deleteExam, setExamClassrooms } from '../services/examService.js'
import { saveExamManualDuties, clearExamDuties } from '../services/dutyService.js'
import { deriveTeacherDutyCounts } from '../algorithms/dutyAllocation.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import {
  Plus,
  Search,
  Wand2,
  PenSquare,
  Trash2,
  Edit2,
  Sparkles,
  Users,
  AlertCircle,
  Calendar,
  Clock,
  Shield,
  CheckCircle2
} from 'lucide-react'

const EMPTY_FORM = { examId: '', date: '', day: '', shift: 'Morning', startTime: '09:00', endTime: '12:00', subject: '' }

export default function Exams() {
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const classrooms = useClassrooms()
  const duties = useDuties()
  const teachers = useTeachers()
  const toast = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'Pending' | 'Duties Assigned'

  // Exam create/edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  // Manual Duty Assignment modal state
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualExam, setManualExam] = useState(null)
  const [manualRoomAssignments, setManualRoomAssignments] = useState([])
  const [manualBackupTeachers, setManualBackupTeachers] = useState([])
  const [newBackupTeacherId, setNewBackupTeacherId] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [confirmClearExam, setConfirmClearExam] = useState(null)

  // Map exam classrooms
  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  // Count duties per exam
  const dutiesByExam = useMemo(() => {
    const map = new Map()
    for (const d of duties) {
      map.set(d.examId, (map.get(d.examId) || 0) + 1)
    }
    return map
  }, [duties])

  // Duty counts per teacher for workload balance reference
  const teacherDutyCounts = useMemo(() => deriveTeacherDutyCounts(teachers, duties), [teachers, duties])
  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === 'Active'), [teachers])

  // Process rows with filtering
  const allExamRows = useMemo(() => {
    return exams.map((e) => ({
      ...e,
      classroomList: roomsByExam.get(e.examId) || [],
      status: dutiesByExam.get(e.examId) ? 'Duties Assigned' : 'Pending'
    }))
  }, [exams, roomsByExam, dutiesByExam])

  const pendingCount = useMemo(() => allExamRows.filter((r) => r.status === 'Pending').length, [allExamRows])
  const assignedCount = useMemo(() => allExamRows.filter((r) => r.status === 'Duties Assigned').length, [allExamRows])

  const rows = useMemo(() => {
    return allExamRows
      .filter((e) => !dateFilter || e.date === dateFilter)
      .filter((e) => !shiftFilter || e.shift === shiftFilter)
      .filter((e) => !statusFilter || e.status === statusFilter)
      .filter(
        (e) =>
          !search ||
          e.subject?.toLowerCase().includes(search.toLowerCase()) ||
          e.examId?.toLowerCase().includes(search.toLowerCase())
      )
  }, [allExamRows, dateFilter, shiftFilter, statusFilter, search])

  // Open Exam Create / Edit
  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ ...row, classroomIds: roomsByExam.get(row.examId) || [] })
    setModalOpen(true)
  }

  async function handleSaveExam(e) {
    e.preventDefault()
    if (!form.examId || !form.date || !form.subject) {
      toast.error('Exam ID, date and subject are required.')
      return
    }
    if (!editing && exams.some((x) => x.examId === form.examId)) {
      toast.error(`Exam ID "${form.examId}" already exists.`)
      return
    }
    const day = form.day || new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    const { classroomIds, ...examRecord } = form
    await upsertExam({ ...examRecord, day }, { isNew: !editing })
    if (classroomIds) {
      await setExamClassrooms(form.examId, classroomIds)
    }
    toast.success(`${form.subject} ${editing ? 'updated' : 'added'}.`)
    setModalOpen(false)
  }

  async function handleDelete() {
    setDeleteError('')
    try {
      await deleteExam(confirmDelete.examId)
      toast.success(`${confirmDelete.subject} deleted.`)
      setConfirmDelete(null)
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  // Open Manual Duty Assignment for a specific exam
  function openManualDutyModal(examRecord) {
    const targetExam = exams.find((e) => e.examId === examRecord.examId) || examRecord
    const targetRooms = roomsByExam.get(targetExam.examId) || []

    const existingExamDuties = duties.filter((d) => d.examId === targetExam.examId)

    // Build initial room assignments from existing duties
    const initialAssignments = targetRooms.map((classroomId) => {
      const roomDuties = existingExamDuties.filter((d) => d.classroomId === classroomId)
      const primaries = roomDuties.filter((d) => d.role === 'PRIMARY').map((d) => d.teacherId)
      const backup = roomDuties.find((d) => d.role === 'BACKUP')?.teacherId || ''
      return {
        classroomId,
        teacher1: primaries[0] || '',
        teacher2: primaries[1] || '',
        backupTeacher: backup
      }
    })

    const existingShiftBackups = existingExamDuties
      .filter((d) => d.classroomId === 'SHIFT_BACKUP')
      .map((d) => d.teacherId)

    setManualExam(targetExam)
    setManualRoomAssignments(initialAssignments)
    setManualBackupTeachers(existingShiftBackups)
    setNewBackupTeacherId('')
    setManualReason('')
    setManualModalOpen(true)
  }

  // Update room assignment state
  function handleRoomTeacherChange(classroomId, field, teacherId) {
    setManualRoomAssignments((prev) =>
      prev.map((r) => (r.classroomId === classroomId ? { ...r, [field]: teacherId } : r))
    )
  }

  // Auto-fill available teachers with least duties
  function handleAutoFillSuggestions() {
    if (!manualExam) return

    // Find teachers already assigned in this date & shift for OTHER exams
    const busyTeacherIds = new Set(
      duties
        .filter((d) => d.date === manualExam.date && d.shift === manualExam.shift && d.examId !== manualExam.examId)
        .map((d) => d.teacherId)
    )

    // Candidates sorted by duty count ascending
    const availableCandidates = activeTeachers
      .filter((t) => !busyTeacherIds.has(t.teacherId))
      .sort((a, b) => {
        const countA = teacherDutyCounts.get(a.teacherId)?.total || 0
        const countB = teacherDutyCounts.get(b.teacherId)?.total || 0
        return countA - countB
      })

    const usedInThisExam = new Set()

    // Keep existing selections if valid
    const updated = manualRoomAssignments.map((r) => {
      let t1 = r.teacher1
      let t2 = r.teacher2
      let backup = r.backupTeacher

      if (t1 && !busyTeacherIds.has(t1) && !usedInThisExam.has(t1)) {
        usedInThisExam.add(t1)
      } else {
        t1 = ''
      }

      if (t2 && !busyTeacherIds.has(t2) && !usedInThisExam.has(t2)) {
        usedInThisExam.add(t2)
      } else {
        t2 = ''
      }

      if (backup && !busyTeacherIds.has(backup) && !usedInThisExam.has(backup)) {
        usedInThisExam.add(backup)
      } else {
        backup = ''
      }

      // Fill missing
      if (!t1) {
        const pick = availableCandidates.find((c) => !usedInThisExam.has(c.teacherId))
        if (pick) {
          t1 = pick.teacherId
          usedInThisExam.add(t1)
        }
      }

      if (!t2) {
        const pick = availableCandidates.find((c) => !usedInThisExam.has(c.teacherId))
        if (pick) {
          t2 = pick.teacherId
          usedInThisExam.add(t2)
        }
      }

      return { ...r, teacher1: t1, teacher2: t2, backupTeacher: backup }
    })

    setManualRoomAssignments(updated)
    toast.success('Suggested available faculty with lowest duty counts.')
  }

  // Save manual assignments for exam
  async function handleSaveManualDuties(e) {
    e.preventDefault()
    if (!manualExam) return

    setSavingManual(true)
    try {
      const result = await saveExamManualDuties({
        examId: manualExam.examId,
        roomAssignments: manualRoomAssignments,
        backupTeachers: manualBackupTeachers,
        reason: manualReason
      })
      toast.success(`Successfully saved ${result.savedCount} duty assignments for ${manualExam.subject}!`)
      setManualModalOpen(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save duties')
    } finally {
      setSavingManual(false)
    }
  }

  // Clear duties for exam
  async function handleClearExamDuties() {
    if (!confirmClearExam) return
    try {
      await clearExamDuties(confirmClearExam.examId)
      toast.success(`Duties cleared for ${confirmClearExam.subject}. Status set to Pending.`)
      setConfirmClearExam(null)
      setManualModalOpen(false)
    } catch (err) {
      toast.error(err.message || 'Failed to clear duties')
    }
  }

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'day', label: 'Day', sortable: true },
    { key: 'shift', label: 'Shift', sortable: true },
    { key: 'startTime', label: 'Time', render: (r) => `${r.startTime}–${r.endTime}` },
    { key: 'subject', label: 'Subject', sortable: true },
    {
      key: 'classroomList',
      label: 'Classrooms',
      render: (r) =>
        r.classroomList.length ? (
          <span className="text-xs font-mono text-ink-800 bg-ink-100 px-2 py-0.5 rounded">
            {r.classroomList.join(', ')}
          </span>
        ) : (
          <span className="text-coral-500 text-xs font-medium">No classrooms assigned</span>
        )
    },
    {
      key: 'status',
      label: 'Duty Status',
      sortable: true,
      render: (r) => (
        <Badge tone={r.status === 'Duties Assigned' ? 'blue' : 'amber'}>
          {r.status}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Duty Management',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={r.status === 'Pending' ? 'primary' : 'secondary'}
            className={`text-xs py-1 px-2.5 ${
              r.status === 'Pending'
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-2xs'
                : 'border-ink-200 hover:border-brand-300 hover:text-brand-700'
            }`}
            onClick={() => openManualDutyModal(r)}
            title="Assign or edit teachers manually for this exam"
          >
            <PenSquare size={13} /> {r.status === 'Pending' ? 'Assign Duties' : 'Edit Duties'}
          </Button>

          <button
            onClick={() => openEdit(r)}
            className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded focus-ring"
            title="Edit exam details"
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={() => {
              setConfirmDelete(r)
              setDeleteError('')
            }}
            className="p-1.5 text-ink-400 hover:text-coral-600 hover:bg-coral-50 rounded focus-ring"
            title="Delete exam"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  return (
    <Layout
      title="Exams"
      subtitle={`${exams.length} exams scheduled · ${pendingCount} pending duty allocation`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              const pendingExam = allExamRows.find((r) => r.status === 'Pending') || allExamRows[0]
              if (pendingExam) {
                openManualDutyModal(pendingExam)
              } else {
                toast.info('No exams available.')
              }
            }}
          >
            <PenSquare size={15} /> Assign Duties Manually
          </Button>
          <Button variant="secondary" onClick={() => navigate('/generate-duties')}>
            <Wand2 size={15} /> Auto Generate
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Exam
          </Button>
        </>
      }
    >
      <Card>
        {/* Filters Bar */}
        <div className="flex flex-wrap gap-2.5 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              placeholder="Search subject or exam ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />

          <Select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="w-auto min-w-[130px]"
          >
            <option value="">All Shifts</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto min-w-[170px]"
          >
            <option value="">All Statuses ({exams.length})</option>
            <option value="Pending">Pending Duties ({pendingCount})</option>
            <option value="Duties Assigned">Duties Assigned ({assignedCount})</option>
          </Select>

          {(search || dateFilter || shiftFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setDateFilter('')
                setShiftFilter('')
                setStatusFilter('')
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 underline focus-ring rounded"
            >
              Reset
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => openManualDutyModal(row)}
          emptyTitle="No exams found"
          emptyMessage="Add an exam manually or change your filter selection."
        />
      </Card>

      {/* Manual Duty Assignment Modal */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title={`Manual Duty Assignment · ${manualExam?.subject || ''}`}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {dutiesByExam.get(manualExam?.examId) > 0 && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmClearExam(manualExam)}
                >
                  <Trash2 size={13} /> Clear Existing Duties
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setManualModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                form="manual-duty-form"
                disabled={savingManual || manualRoomAssignments.length === 0}
              >
                <CheckCircle2 size={15} /> {savingManual ? 'Saving…' : 'Save Duty Assignments'}
              </Button>
            </div>
          </div>
        }
      >
        {manualExam && (
          <form id="manual-duty-form" onSubmit={handleSaveManualDuties} className="space-y-4">
            {/* Exam Quick Info Banner */}
            <div className="flex flex-wrap items-center justify-between p-3 bg-ink-50 rounded-xl border border-ink-100 gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-900">{manualExam.subject}</span>
                  <Badge tone={dutiesByExam.get(manualExam.examId) ? 'blue' : 'amber'}>
                    {dutiesByExam.get(manualExam.examId) ? 'Duties Assigned' : 'Pending'}
                  </Badge>
                </div>
                <p className="text-xs text-ink-500 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(manualExam.date)} ({manualExam.day})
                  </span>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {manualExam.shift} ({manualExam.startTime}–{manualExam.endTime})
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-xs py-1 px-2.5 bg-white border-brand-200 text-brand-700 hover:bg-brand-50"
                  onClick={handleAutoFillSuggestions}
                  title="Automatically suggest available faculty with least duty counts"
                >
                  <Sparkles size={13} className="text-brand-600" /> Suggest Available Faculty
                </Button>
              </div>
            </div>

            {/* If no classrooms linked */}
            {manualRoomAssignments.length === 0 ? (
              <div className="p-5 text-center bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-2">
                <AlertCircle size={24} className="mx-auto text-amber-600" />
                <p className="font-semibold">No classrooms assigned to this exam yet.</p>
                <p className="text-xs text-amber-700">
                  Edit this exam or go to Exam Schedule to choose which rooms host this exam first.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setManualModalOpen(false)
                    openEdit(manualExam)
                  }}
                >
                  Assign Classrooms to Exam
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
                  Classroom Invigilators (Required: 2 Primaries per room)
                </h4>

                {manualRoomAssignments.map((room, idx) => {
                  const roomRecord = classrooms.find((c) => c.classroomId === room.classroomId)
                  return (
                    <div
                      key={room.classroomId}
                      className="p-3.5 bg-white rounded-xl border border-ink-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center border border-brand-200">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-sm text-ink-900">
                            {roomRecord?.classroomName || room.classroomId}
                          </span>
                          <span className="text-xs font-mono text-ink-400">({room.classroomId})</span>
                        </div>
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-600">
                          Capacity: {roomRecord?.capacity || 30} seats
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Primary Teacher 1" required>
                          <Select
                            value={room.teacher1}
                            onChange={(e) =>
                              handleRoomTeacherChange(room.classroomId, 'teacher1', e.target.value)
                            }
                            required
                          >
                            <option value="">Choose primary teacher 1…</option>
                            {activeTeachers.map((t) => {
                              const count = teacherDutyCounts.get(t.teacherId)?.total || 0
                              return (
                                <option key={t.teacherId} value={t.teacherId}>
                                  {t.teacherName} ({t.department || '—'} &middot; {count} {count === 1 ? 'duty' : 'duties'})
                                </option>
                              )
                            })}
                          </Select>
                        </Field>

                        <Field label="Primary Teacher 2" required>
                          <Select
                            value={room.teacher2}
                            onChange={(e) =>
                              handleRoomTeacherChange(room.classroomId, 'teacher2', e.target.value)
                            }
                            required
                          >
                            <option value="">Choose primary teacher 2…</option>
                            {activeTeachers.map((t) => {
                              const count = teacherDutyCounts.get(t.teacherId)?.total || 0
                              return (
                                <option key={t.teacherId} value={t.teacherId}>
                                  {t.teacherName} ({t.department || '—'} &middot; {count} {count === 1 ? 'duty' : 'duties'})
                                </option>
                              )
                            })}
                          </Select>
                        </Field>
                      </div>

                      <Field label="Room Backup Teacher (Optional)">
                        <Select
                          value={room.backupTeacher}
                          onChange={(e) =>
                            handleRoomTeacherChange(room.classroomId, 'backupTeacher', e.target.value)
                          }
                        >
                          <option value="">— None (or rely on Shift Backup Pool) —</option>
                          {activeTeachers.map((t) => {
                            const count = teacherDutyCounts.get(t.teacherId)?.total || 0
                            return (
                              <option key={t.teacherId} value={t.teacherId}>
                                {t.teacherName} ({t.department || '—'} &middot; {count} {count === 1 ? 'duty' : 'duties'})
                              </option>
                            )
                          })}
                        </Select>
                      </Field>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Shift Backup Pool Section */}
            <div className="p-3.5 bg-brand-50/40 rounded-xl border border-brand-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={13} className="text-brand-600" /> Shift Backup Pool Teachers
                  </h4>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Floating backups available for {manualExam.shift} shift emergency replacements.
                  </p>
                </div>
              </div>

              {manualBackupTeachers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {manualBackupTeachers.map((id) => {
                    const t = teachers.find((x) => x.teacherId === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-brand-200 text-xs font-medium text-ink-800 shadow-2xs"
                      >
                        {t?.teacherName || id}
                        <button
                          type="button"
                          onClick={() =>
                            setManualBackupTeachers((prev) => prev.filter((tid) => tid !== id))
                          }
                          className="text-ink-400 hover:text-coral-500 rounded"
                        >
                          &times;
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Select
                  value={newBackupTeacherId}
                  onChange={(e) => setNewBackupTeacherId(e.target.value)}
                  className="flex-1 text-xs"
                >
                  <option value="">Select a teacher to add to Shift Backup Pool…</option>
                  {activeTeachers
                    .filter((t) => !manualBackupTeachers.includes(t.teacherId))
                    .map((t) => {
                      const count = teacherDutyCounts.get(t.teacherId)?.total || 0
                      return (
                        <option key={t.teacherId} value={t.teacherId}>
                          {t.teacherName} ({t.department || '—'} &middot; {count} duties)
                        </option>
                      )
                    })}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!newBackupTeacherId}
                  onClick={() => {
                    if (newBackupTeacherId && !manualBackupTeachers.includes(newBackupTeacherId)) {
                      setManualBackupTeachers((prev) => [...prev, newBackupTeacherId])
                      setNewBackupTeacherId('')
                    }
                  }}
                >
                  <Plus size={13} /> Add
                </Button>
              </div>
            </div>

            <Field label="Assignment Notes / Reason (Optional)">
              <Input
                placeholder="e.g. Manual assignment request or schedule override"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
              />
            </Field>
          </form>
        )}
      </Modal>

      {/* Exam Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Exam' : 'Add Exam'}
        width="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveExam} type="submit" form="exam-form">
              Save Exam
            </Button>
          </>
        }
      >
        <form id="exam-form" onSubmit={handleSaveExam}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exam ID" required>
              <Input
                value={form.examId}
                disabled={!!editing}
                onChange={(e) => setForm((f) => ({ ...f, examId: e.target.value }))}
                placeholder="E001"
              />
            </Field>
            <Field label="Subject" required>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="CSE101"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </Field>
            <Field label="Shift">
              <Select
                value={form.shift}
                onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
              >
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </Field>
            <Field label="End Time">
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </Field>
          </div>
          <Field
            label="Classrooms for this exam"
            hint="Select every room this exam is held in. You can also assign these later on the Exam Schedule page."
          >
            <div className="max-h-40 overflow-y-auto rounded-md border border-ink-200 p-2 space-y-1">
              {classrooms.length === 0 && (
                <p className="text-xs text-ink-400 px-1">No classrooms yet.</p>
              )}
              {classrooms.map((c) => {
                return (
                  <label
                    key={c.classroomId}
                    className="flex items-center gap-2 text-sm px-1 py-0.5 rounded hover:bg-ink-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.classroomIds?.includes(c.classroomId) || false}
                      onChange={(e) => {
                        setForm((f) => {
                          const set = new Set(f.classroomIds || [])
                          if (e.target.checked) set.add(c.classroomId)
                          else set.delete(c.classroomId)
                          return { ...f, classroomIds: [...set] }
                        })
                      }}
                    />
                    {c.classroomName} ({c.classroomId})
                  </label>
                )
              })}
            </div>
          </Field>
        </form>
      </Modal>

      {/* Delete Exam Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete exam?"
        message={
          deleteError ||
          `Are you sure you want to delete ${confirmDelete?.subject}? This cannot be undone.`
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(null)
          setDeleteError('')
        }}
      />

      {/* Clear Duties for Exam Dialog */}
      <ConfirmDialog
        open={!!confirmClearExam}
        title="Clear Duties for Exam?"
        message={
          confirmClearExam
            ? `Are you sure you want to clear all teacher duty assignments for "${confirmClearExam.subject}" (${formatDate(confirmClearExam.date)} ${confirmClearExam.shift})? Its status will revert to Pending.`
            : ''
        }
        confirmLabel="Clear Duties"
        tone="danger"
        onConfirm={handleClearExamDuties}
        onCancel={() => setConfirmClearExam(null)}
      />
    </Layout>
  )
}
