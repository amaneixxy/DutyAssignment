import React, { useMemo, useState } from 'react'
import Layout from '../../components/layout/Layout.jsx'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import { Field, Select, Input, TextArea } from '../../components/common/Field.jsx'
import DataTable from '../../components/tables/DataTable.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useTeachers } from '../../hooks/useTeachers.js'
import { useDuties, useClassrooms } from '../../hooks/useDuties.js'
import { useExams, useExamClassrooms } from '../../hooks/useExams.js'
import { deriveTeacherDutyCounts } from '../../algorithms/dutyAllocation.js'
import { downloadCsv } from '../../services/csvService.js'
import {
  deleteDuty,
  updateDutyRole,
  reassignDuty,
  assignDutyToTeacher
} from '../../services/dutyService.js'
import { useToast } from '../../components/common/Toast.jsx'
import { formatDate } from '../../utils/dateUtils.js'
import {
  Download,
  Printer,
  PenSquare,
  Plus,
  Trash2,
  ArrowRightLeft,
  Calendar,
  Clock,
  Building2,
  Users,
  Shield,
  ShieldCheck,
  Search,
  BookOpen
} from 'lucide-react'

export default function ReportsTeacherDuties() {
  const teachers = useTeachers()
  const duties = useDuties()
  const exams = useExams()
  const classrooms = useClassrooms()
  const examClassrooms = useExamClassrooms()
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  // State for teacher duty editor modal
  const [selectedTeacherId, setSelectedTeacherId] = useState(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  // Sub-modal state inside teacher duties modal (for adding duty to selected teacher)
  const [newDutyExamId, setNewDutyExamId] = useState('')
  const [newDutyClassroomId, setNewDutyClassroomId] = useState('')
  const [newDutyRole, setNewDutyRole] = useState('PRIMARY')
  const [newDutyReason, setNewDutyReason] = useState('')
  const [isAddingDuty, setIsAddingDuty] = useState(false)

  // Global assign modal state
  const [globalTeacherId, setGlobalTeacherId] = useState('')
  const [globalExamId, setGlobalExamId] = useState('')
  const [globalClassroomId, setGlobalClassroomId] = useState('')
  const [globalRole, setGlobalRole] = useState('PRIMARY')
  const [globalReason, setGlobalReason] = useState('')

  // Reassigning state
  const [reassigningDuty, setReassigningDuty] = useState(null)
  const [targetTeacherId, setTargetTeacherId] = useState('')
  const [reassignReason, setReassignReason] = useState('')

  // Delete confirm state
  const [deletingDuty, setDeletingDuty] = useState(null)

  // Department list for filtering
  const departments = useMemo(() => {
    const set = new Set(teachers.map((t) => t.department).filter(Boolean))
    return [...set].sort()
  }, [teachers])

  // Classrooms by exam mapping
  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  // Aggregate teacher duty counts
  const rawRows = useMemo(() => {
    const map = deriveTeacherDutyCounts(teachers, duties)
    return [...map.values()]
      .map((r) => {
        const t = teachers.find((x) => x.teacherId === r.teacherId)
        return {
          ...r,
          teacherName: t?.teacherName || r.teacherId,
          department: t?.department || '—',
          status: t?.status || 'Active'
        }
      })
      .sort((a, b) => b.total - a.total || a.teacherName.localeCompare(b.teacherName))
  }, [teachers, duties])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.teacherId.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDept = !departmentFilter || r.department === departmentFilter
      return matchesSearch && matchesDept
    })
  }, [rawRows, searchQuery, departmentFilter])

  // Summary statistics
  const stats = useMemo(() => {
    const totalTeachers = teachers.length
    const totalPrimary = duties.filter((d) => d.role === 'PRIMARY').length
    const totalBackup = duties.filter((d) => d.role === 'BACKUP').length
    const totalAssignments = duties.length
    return { totalTeachers, totalPrimary, totalBackup, totalAssignments }
  }, [teachers, duties])

  const selectedTeacher = teachers.find((t) => t.teacherId === selectedTeacherId)
  const teacherDuties = useMemo(() => {
    if (!selectedTeacherId) return []
    return duties.filter((d) => d.teacherId === selectedTeacherId)
  }, [duties, selectedTeacherId])

  const availableRoomsForNewDuty = newDutyExamId ? roomsByExam.get(newDutyExamId) || [] : []
  const availableRoomsForGlobal = globalExamId ? roomsByExam.get(globalExamId) || [] : []

  function exportCsv() {
    downloadCsv(
      'teacher_duty_summary.csv',
      filteredRows.map((r) => ({
        teacher_id: r.teacherId,
        teacher_name: r.teacherName,
        department: r.department,
        primary_duties: r.primary,
        backup_duties: r.backup,
        total_duties: r.total
      }))
    )
    toast.success('teacher_duty_summary.csv downloaded.')
  }

  // Handle changing role directly
  async function handleRoleChange(duty, newRole) {
    if (duty.role === newRole) return
    try {
      await updateDutyRole(duty.id, newRole, { reason: 'Updated via Teacher Duty Report' })
      toast.success(`Role updated to ${newRole} for ${selectedTeacher?.teacherName || duty.teacherId}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update duty role')
    }
  }

  // Handle deleting duty
  async function handleDeleteConfirm() {
    if (!deletingDuty) return
    try {
      await deleteDuty(deletingDuty.id, { reason: 'Manually removed from Teacher Duty Report' })
      toast.success('Duty assignment removed successfully.')
      setDeletingDuty(null)
    } catch (err) {
      toast.error(err.message || 'Failed to remove duty')
    }
  }

  // Handle reassigning duty
  async function handleReassignConfirm() {
    if (!reassigningDuty || !targetTeacherId) return
    try {
      await reassignDuty(reassigningDuty.id, targetTeacherId, { reason: reassignReason })
      const targetT = teachers.find((t) => t.teacherId === targetTeacherId)
      toast.success(`Duty reassigned to ${targetT?.teacherName || targetTeacherId}.`)
      setReassigningDuty(null)
      setTargetTeacherId('')
      setReassignReason('')
    } catch (err) {
      toast.error(err.message || 'Failed to reassign duty')
    }
  }

  // Handle adding duty to selected teacher
  async function handleAddDutyToTeacher(e) {
    e.preventDefault()
    if (!newDutyExamId || !newDutyClassroomId) {
      toast.error('Please select both an exam and a classroom.')
      return
    }

    try {
      await assignDutyToTeacher({
        teacherId: selectedTeacherId,
        examId: newDutyExamId,
        classroomId: newDutyClassroomId,
        role: newDutyRole,
        reason: newDutyReason
      })
      toast.success(`Duty assigned to ${selectedTeacher?.teacherName || selectedTeacherId}.`)
      setNewDutyExamId('')
      setNewDutyClassroomId('')
      setNewDutyReason('')
      setIsAddingDuty(false)
    } catch (err) {
      toast.error(err.message || 'Failed to assign duty')
    }
  }

  // Handle global manual assignment
  async function handleGlobalAssign(e) {
    e.preventDefault()
    if (!globalTeacherId || !globalExamId || !globalClassroomId) {
      toast.error('Please select a teacher, exam, and classroom.')
      return
    }

    try {
      await assignDutyToTeacher({
        teacherId: globalTeacherId,
        examId: globalExamId,
        classroomId: globalClassroomId,
        role: globalRole,
        reason: globalReason
      })
      const t = teachers.find((x) => x.teacherId === globalTeacherId)
      toast.success(`Duty assigned to ${t?.teacherName || globalTeacherId}.`)
      setGlobalTeacherId('')
      setGlobalExamId('')
      setGlobalClassroomId('')
      setGlobalReason('')
      setIsAssignModalOpen(false)
    } catch (err) {
      toast.error(err.message || 'Failed to assign duty')
    }
  }

  const columns = [
    {
      key: 'teacherName',
      label: 'Teacher',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-ink-900">{r.teacherName}</span>
          <span className="text-xs text-ink-400 block font-mono">{r.teacherId}</span>
        </div>
      )
    },
    { key: 'department', label: 'Department', sortable: true },
    {
      key: 'primary',
      label: 'Primary',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {r.primary}
        </span>
      )
    },
    {
      key: 'backup',
      label: 'Backup',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {r.backup}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
          {r.total}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Manual Edit',
      render: (r) => (
        <Button
          variant="secondary"
          className="text-xs py-1 px-3 border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300 shadow-2xs"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedTeacherId(r.teacherId)
            setIsAddingDuty(false)
          }}
        >
          <PenSquare size={13} /> Edit Duties
        </Button>
      )
    }
  ]

  return (
    <Layout
      title="Teacher Duty Report"
      subtitle="View, edit, add, or reassign duty counts per teacher"
      actions={
        <>
          <Button variant="primary" onClick={() => setIsAssignModalOpen(true)}>
            <Plus size={15} /> Assign Duty
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* KPI Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-white to-ink-50/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">Faculty Count</p>
                <p className="text-2xl font-bold text-ink-900 mt-1">{stats.totalTeachers}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-ink-100 text-ink-600">
                <Users size={20} />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-blue-50/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Primary Duties</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{stats.totalPrimary}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                <ShieldCheck size={20} />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-amber-50/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Backup Duties</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{stats.totalBackup}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                <Shield size={20} />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-brand-50/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-600 uppercase tracking-wider">Total Scheduled</p>
                <p className="text-2xl font-bold text-brand-900 mt-1">{stats.totalAssignments}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-brand-100 text-brand-600">
                <BookOpen size={20} />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Controls & Main Table */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  placeholder="Search by teacher name or ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-auto min-w-[170px]"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
            {(searchQuery || departmentFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setDepartmentFilter('')
                }}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 underline focus-ring rounded"
              >
                Clear filters
              </button>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={filteredRows}
            pageSize={15}
            onRowClick={(row) => setSelectedTeacherId(row.teacherId)}
            emptyTitle="No teachers found"
            emptyMessage="Try adjusting your search or generate duties first."
          />
        </Card>
      </div>

      {/* Teacher Duties Management Modal */}
      <Modal
        open={!!selectedTeacherId}
        onClose={() => {
          setSelectedTeacherId(null)
          setIsAddingDuty(false)
        }}
        title={`Manage Duties: ${selectedTeacher?.teacherName || selectedTeacherId}`}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-ink-400">
              Changes update duty history and live reports in real time.
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedTeacherId(null)
                setIsAddingDuty(false)
              }}
            >
              Done
            </Button>
          </div>
        }
      >
        {selectedTeacher && (
          <div className="space-y-5">
            {/* Teacher Info Card */}
            <div className="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl border border-ink-100">
              <div>
                <p className="text-sm font-semibold text-ink-900">{selectedTeacher.teacherName}</p>
                <p className="text-xs text-ink-500 font-mono">
                  ID: {selectedTeacher.teacherId} &middot; Dept: {selectedTeacher.department || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Primary: {teacherDuties.filter((d) => d.role === 'PRIMARY').length}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  Backup: {teacherDuties.filter((d) => d.role === 'BACKUP').length}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                  Total: {teacherDuties.length}
                </span>
              </div>
            </div>

            {/* List of Assigned Duties */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <Calendar size={15} className="text-ink-400" />
                  Assigned Duties ({teacherDuties.length})
                </h3>
                {!isAddingDuty && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs py-1 px-2.5"
                    onClick={() => setIsAddingDuty(true)}
                  >
                    <Plus size={13} /> Add Duty
                  </Button>
                )}
              </div>

              {teacherDuties.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-ink-200 rounded-xl bg-ink-50/50">
                  <p className="text-sm text-ink-600 font-medium">No duties assigned yet.</p>
                  <p className="text-xs text-ink-400 mt-1">
                    Click "Add Duty" below to manually assign this teacher to an exam session.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-3 text-xs"
                    onClick={() => setIsAddingDuty(true)}
                  >
                    <Plus size={13} /> Assign First Duty
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {teacherDuties.map((duty) => (
                    <div
                      key={duty.id}
                      className="p-3 bg-white rounded-lg border border-ink-200 hover:border-ink-300 shadow-2xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">{duty.subject}</span>
                          <Badge tone={duty.role === 'PRIMARY' ? 'blue' : 'amber'}>
                            {duty.role}
                          </Badge>
                          {duty.classroomId === 'SHIFT_BACKUP' ? (
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Shift Backup Pool
                            </span>
                          ) : (
                            <span className="text-xs text-ink-600 bg-ink-100 px-2 py-0.5 rounded font-mono">
                              {classrooms.find((c) => c.classroomId === duty.classroomId)?.classroomName ||
                                duty.classroomId}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-500 flex items-center gap-1.5">
                          <span>{formatDate(duty.date)}</span>
                          <span>&middot;</span>
                          <span className="font-medium text-ink-700">{duty.shift}</span>
                          {duty.startTime && (
                            <>
                              <span>&middot;</span>
                              <span>
                                {duty.startTime}–{duty.endTime}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Role switcher */}
                        <Select
                          value={duty.role}
                          onChange={(e) => handleRoleChange(duty, e.target.value)}
                          className="text-xs py-1 px-2 w-auto font-medium h-8"
                          title="Switch Role"
                        >
                          <option value="PRIMARY">Primary</option>
                          <option value="BACKUP">Backup</option>
                        </Select>

                        {/* Reassign button */}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          title="Reassign to another teacher"
                          onClick={() => {
                            setReassigningDuty(duty)
                            setTargetTeacherId('')
                            setReassignReason('')
                          }}
                        >
                          <ArrowRightLeft size={13} />
                        </Button>

                        {/* Delete duty button */}
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 px-2 text-xs"
                          title="Remove duty assignment"
                          onClick={() => setDeletingDuty(duty)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Duty Inline Form */}
            {isAddingDuty && (
              <form
                onSubmit={handleAddDutyToTeacher}
                className="p-4 bg-brand-50/50 rounded-xl border border-brand-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-brand-900 flex items-center gap-1.5">
                    <Plus size={14} className="text-brand-600" /> Assign New Duty to {selectedTeacher.teacherName}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingDuty(false)}
                    className="text-xs text-ink-500 hover:text-ink-800"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Exam" required>
                    <Select
                      value={newDutyExamId}
                      onChange={(e) => {
                        setNewDutyExamId(e.target.value)
                        setNewDutyClassroomId('')
                      }}
                      required
                    >
                      <option value="">Select an exam…</option>
                      {exams.map((e) => (
                        <option key={e.examId} value={e.examId}>
                          {e.subject} ({formatDate(e.date)} - {e.shift})
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Classroom / Pool" required>
                    <Select
                      value={newDutyClassroomId}
                      onChange={(e) => setNewDutyClassroomId(e.target.value)}
                      disabled={!newDutyExamId}
                      required
                    >
                      <option value="">Select classroom…</option>
                      {availableRoomsForNewDuty.map((id) => (
                        <option key={id} value={id}>
                          {classrooms.find((c) => c.classroomId === id)?.classroomName || id}
                        </option>
                      ))}
                      <option value="SHIFT_BACKUP">Shift Backup Pool (Floating)</option>
                    </Select>
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Role">
                    <Select
                      value={newDutyRole}
                      onChange={(e) => setNewDutyRole(e.target.value)}
                    >
                      <option value="PRIMARY">PRIMARY</option>
                      <option value="BACKUP">BACKUP</option>
                    </Select>
                  </Field>

                  <Field label="Reason / Notes (optional)">
                    <Input
                      placeholder="e.g. Manual assignment request"
                      value={newDutyReason}
                      onChange={(e) => setNewDutyReason(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingDuty(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Assign Duty
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Global Assign Duty Modal */}
      <Modal
        open={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Manually Assign Teacher Duty"
        width="max-w-lg"
      >
        <form onSubmit={handleGlobalAssign} className="space-y-4">
          <Field label="Teacher" required>
            <Select
              value={globalTeacherId}
              onChange={(e) => setGlobalTeacherId(e.target.value)}
              required
            >
              <option value="">Choose teacher…</option>
              {teachers
                .filter((t) => t.status === 'Active')
                .map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName} ({t.department || t.teacherId})
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Exam" required>
            <Select
              value={globalExamId}
              onChange={(e) => {
                setGlobalExamId(e.target.value)
                setGlobalClassroomId('')
              }}
              required
            >
              <option value="">Choose exam…</option>
              {exams.map((e) => (
                <option key={e.examId} value={e.examId}>
                  {e.subject} &middot; {formatDate(e.date)} ({e.shift})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Classroom" required>
            <Select
              value={globalClassroomId}
              onChange={(e) => setGlobalClassroomId(e.target.value)}
              disabled={!globalExamId}
              required
            >
              <option value="">Choose classroom…</option>
              {availableRoomsForGlobal.map((id) => (
                <option key={id} value={id}>
                  {classrooms.find((c) => c.classroomId === id)?.classroomName || id}
                </option>
              ))}
              <option value="SHIFT_BACKUP">Shift Backup Pool (Floating)</option>
            </Select>
          </Field>

          <Field label="Duty Role" required>
            <Select value={globalRole} onChange={(e) => setGlobalRole(e.target.value)}>
              <option value="PRIMARY">PRIMARY Teacher</option>
              <option value="BACKUP">BACKUP Teacher</option>
            </Select>
          </Field>

          <Field label="Reason / Notes (optional)">
            <Input
              placeholder="e.g. Schedule override"
              value={globalReason}
              onChange={(e) => setGlobalReason(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-ink-100">
            <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Assign Duty
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassign Duty Modal */}
      <Modal
        open={!!reassigningDuty}
        onClose={() => {
          setReassigningDuty(null)
          setTargetTeacherId('')
          setReassignReason('')
        }}
        title="Reassign Duty Slot"
        width="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setReassigningDuty(null)
                setTargetTeacherId('')
                setReassignReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!targetTeacherId}
              onClick={handleReassignConfirm}
            >
              Confirm Reassignment
            </Button>
          </>
        }
      >
        {reassigningDuty && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              Transferring <strong>{reassigningDuty.subject}</strong> ({formatDate(reassigningDuty.date)} {reassigningDuty.shift}) from{' '}
              <strong>
                {teachers.find((t) => t.teacherId === reassigningDuty.teacherId)?.teacherName ||
                  reassigningDuty.teacherId}
              </strong>.
            </div>

            <Field label="Select New Teacher" required>
              <Select
                value={targetTeacherId}
                onChange={(e) => setTargetTeacherId(e.target.value)}
                required
              >
                <option value="">Choose replacement teacher…</option>
                {teachers
                  .filter(
                    (t) =>
                      t.status === 'Active' &&
                      t.teacherId !== reassigningDuty.teacherId
                  )
                  .map((t) => (
                    <option key={t.teacherId} value={t.teacherId}>
                      {t.teacherName} ({t.department || t.teacherId})
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Reason (optional)">
              <Input
                placeholder="e.g. Schedule swap / mutual agreement"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* Delete Duty Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingDuty}
        title="Remove Duty Assignment?"
        message={
          deletingDuty
            ? `Are you sure you want to remove the ${deletingDuty.role} duty for "${deletingDuty.subject}" on ${formatDate(deletingDuty.date)} (${deletingDuty.shift}) from ${selectedTeacher?.teacherName || deletingDuty.teacherId}?`
            : ''
        }
        confirmLabel="Remove Duty"
        tone="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDuty(null)}
      />
    </Layout>
  )
}
