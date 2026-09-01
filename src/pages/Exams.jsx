import React, { useMemo, useState } from 'react'
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
import { upsertExam, deleteExam, setExamClassrooms } from '../services/examService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { Plus, Search, Wand2 } from 'lucide-react'

const EMPTY_FORM = { examId: '', date: '', day: '', shift: 'Morning', startTime: '09:00', endTime: '12:00', subject: '' }

export default function Exams() {
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const classrooms = useClassrooms()
  const duties = useDuties()
  const toast = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  const dutiesByExam = useMemo(() => {
    const map = new Map()
    for (const d of duties) {
      map.set(d.examId, (map.get(d.examId) || 0) + 1)
    }
    return map
  }, [duties])

  const rows = useMemo(() => {
    return exams
      .filter((e) => !dateFilter || e.date === dateFilter)
      .filter((e) => !shiftFilter || e.shift === shiftFilter)
      .filter((e) => !search || e.subject?.toLowerCase().includes(search.toLowerCase()) || e.examId?.toLowerCase().includes(search.toLowerCase()))
      .map((e) => ({
        ...e,
        classroomList: roomsByExam.get(e.examId) || [],
        status: dutiesByExam.get(e.examId) ? 'Duties Assigned' : 'Pending'
      }))
  }, [exams, dateFilter, shiftFilter, search, roomsByExam, dutiesByExam])

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

  async function handleSave(e) {
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

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'day', label: 'Day', sortable: true },
    { key: 'shift', label: 'Shift', sortable: true },
    { key: 'startTime', label: 'Time', render: (r) => `${r.startTime}–${r.endTime}` },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'classroomList', label: 'Classrooms', render: (r) => (r.classroomList.length ? r.classroomList.join(', ') : <span className="text-ink-400">Not assigned</span>) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge tone={r.status === 'Duties Assigned' ? 'blue' : 'amber'}>{r.status}</Badge>
    }
  ]

  return (
    <Layout
      title="Exams"
      subtitle={`${exams.length} exams scheduled`}
      actions={
        <>
          <Button variant="secondary" onClick={() => navigate('/generate-duties')}>
            <Wand2 size={15} /> Generate Duties
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Exam
          </Button>
        </>
      }
    >
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="Search subject or ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto" />
          <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">All Shifts</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={openEdit}
          emptyTitle="No exams found"
          emptyMessage="Add an exam manually or import an Exam Schedule CSV file."
        />
      </Card>

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
            <Button onClick={handleSave} type="submit" form="exam-form">
              Save Exam
            </Button>
          </>
        }
      >
        <form id="exam-form" onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exam ID" required>
              <Input value={form.examId} disabled={!!editing} onChange={(e) => setForm((f) => ({ ...f, examId: e.target.value }))} placeholder="E001" />
            </Field>
            <Field label="Subject" required>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="CSE101" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Shift">
              <Select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time">
              <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </Field>
            <Field label="End Time">
              <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </Field>
          </div>
          <Field label="Classrooms for this exam" hint="Select every room this exam is held in. You can also assign these later on the Exam Schedule page.">
            <div className="max-h-40 overflow-y-auto rounded-md border border-ink-200 p-2 space-y-1">
              {classrooms.length === 0 && <p className="text-xs text-ink-400 px-1">No classrooms yet.</p>}
              {classrooms.map((c) => {
                return (
                  <label key={c.classroomId} className="flex items-center gap-2 text-sm px-1 py-0.5 rounded hover:bg-ink-50">
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

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete exam?"
        message={deleteError || `Are you sure you want to delete ${confirmDelete?.subject}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(null)
          setDeleteError('')
        }}
      />
    </Layout>
  )
}
