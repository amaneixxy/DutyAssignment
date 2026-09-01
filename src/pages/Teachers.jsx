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
import { useTeachers } from '../hooks/useTeachers.js'
import { useDuties } from '../hooks/useDuties.js'
import { deriveTeacherDutyCounts } from '../algorithms/dutyAllocation.js'
import { upsertTeacher, deleteOrDeactivateTeacher } from '../services/teacherService.js'
import { downloadCsv } from '../services/csvService.js'
import { useToast } from '../components/common/Toast.jsx'
import { Plus, Search, Download } from 'lucide-react'

const EMPTY_FORM = { teacherId: '', teacherName: '', department: '', email: '', phone: '', status: 'Active' }

export default function Teachers() {
  const teachers = useTeachers()
  const duties = useDuties()
  const toast = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const dutyCounts = useMemo(() => deriveTeacherDutyCounts(teachers, duties), [teachers, duties])
  const departments = useMemo(() => [...new Set(teachers.map((t) => t.department).filter(Boolean))].sort(), [teachers])

  const rows = useMemo(() => {
    return teachers
      .filter((t) => !deptFilter || t.department === deptFilter)
      .filter((t) => !statusFilter || t.status === statusFilter)
      .filter((t) => {
        if (!search) return true
        const q = search.toLowerCase()
        return t.teacherName?.toLowerCase().includes(q) || t.teacherId?.toLowerCase().includes(q)
      })
      .map((t) => {
        const d = dutyCounts.get(t.teacherId) || { primary: 0, backup: 0, total: 0 }
        return { ...t, primaryDuties: d.primary, backupDuties: d.backup, totalDuties: d.total }
      })
  }, [teachers, deptFilter, statusFilter, search, dutyCounts])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }
  function openEdit(row) {
    setEditing(row)
    setForm({ ...row })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.teacherId || !form.teacherName) {
      toast.error('Teacher ID and name are required.')
      return
    }
    if (!editing && teachers.some((t) => t.teacherId === form.teacherId)) {
      toast.error(`Teacher ID "${form.teacherId}" already exists.`)
      return
    }
    await upsertTeacher(form, { isNew: !editing })
    toast.success(`${form.teacherName} ${editing ? 'updated' : 'added'}.`)
    setModalOpen(false)
  }

  async function handleDelete() {
    const result = await deleteOrDeactivateTeacher(confirmDelete.teacherId)
    toast.success(
      result.deactivated
        ? `${confirmDelete.teacherName} has duty history, so they were deactivated instead of deleted.`
        : `${confirmDelete.teacherName} deleted.`
    )
    setConfirmDelete(null)
  }

  function exportCsv() {
    downloadCsv(
      'teachers.csv',
      teachers.map((t) => ({
        teacher_id: t.teacherId,
        teacher_name: t.teacherName,
        department: t.department,
        email: t.email,
        phone: t.phone,
        status: t.status
      }))
    )
    toast.success('teachers.csv downloaded.')
  }

  const columns = [
    { key: 'teacherId', label: 'ID', sortable: true },
    { key: 'teacherName', label: 'Teacher', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => <Badge tone={r.status === 'Active' ? 'green' : 'gray'}>{r.status}</Badge>
    },
    { key: 'primaryDuties', label: 'Primary Duties', sortable: true },
    { key: 'backupDuties', label: 'Backup Duties', sortable: true },
    { key: 'totalDuties', label: 'Total Duties', sortable: true }
  ]

  return (
    <Layout
      title="Teachers"
      subtitle={`${teachers.length} teachers on record`}
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Teacher
          </Button>
        </>
      }
    >
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[130px]">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => navigate(`/teachers/${row.teacherId}`)}
          emptyTitle="No teachers found"
          emptyMessage="Add a teacher manually or import a Teachers CSV file."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} type="submit" form="teacher-form">
              Save Teacher
            </Button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={handleSave}>
          <Field label="Teacher ID" required>
            <Input
              value={form.teacherId}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
              placeholder="T001"
            />
          </Field>
          <Field label="Full Name" required>
            <Input
              value={form.teacherName}
              onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))}
              placeholder="Rahul Sharma"
            />
          </Field>
          <Field label="Department">
            <Input
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              placeholder="Mathematics"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="rahul@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </Field>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setModalOpen(false)
                setConfirmDelete(editing)
              }}
              className="text-sm text-coral-500 hover:text-coral-600 mt-1 focus-ring rounded"
            >
              Delete this teacher
            </button>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete teacher?"
        message={`Are you sure you want to delete ${confirmDelete?.teacherName}? If they have any duty history, they'll be deactivated instead so past records stay intact.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Layout>
  )
}
