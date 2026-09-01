import React, { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { Field, Input, Select } from '../components/common/Field.jsx'
import DataTable from '../components/tables/DataTable.jsx'
import { useClassrooms } from '../hooks/useDuties.js'
import { upsertClassroom, deleteOrDeactivateClassroom } from '../services/classroomService.js'
import { downloadCsv } from '../services/csvService.js'
import { useToast } from '../components/common/Toast.jsx'
import { Plus, Search, Download } from 'lucide-react'

const EMPTY_FORM = { classroomId: '', classroomName: '', building: '', floor: '', capacity: '', status: 'Available' }

export default function Classrooms() {
  const classrooms = useClassrooms()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const buildings = useMemo(() => [...new Set(classrooms.map((c) => c.building).filter(Boolean))].sort(), [classrooms])

  const rows = useMemo(() => {
    return classrooms
      .filter((c) => !buildingFilter || c.building === buildingFilter)
      .filter((c) => !statusFilter || c.status === statusFilter)
      .filter((c) => {
        if (!search) return true
        const q = search.toLowerCase()
        return c.classroomName?.toLowerCase().includes(q) || c.classroomId?.toLowerCase().includes(q)
      })
  }, [classrooms, buildingFilter, statusFilter, search])

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
    if (!form.classroomId || !form.classroomName) {
      toast.error('Classroom ID and name are required.')
      return
    }
    if (!editing && classrooms.some((c) => c.classroomId === form.classroomId)) {
      toast.error(`Classroom ID "${form.classroomId}" already exists.`)
      return
    }
    await upsertClassroom({ ...form, capacity: Number(form.capacity) || 0 }, { isNew: !editing })
    toast.success(`${form.classroomName} ${editing ? 'updated' : 'added'}.`)
    setModalOpen(false)
  }

  async function handleDelete() {
    const result = await deleteOrDeactivateClassroom(confirmDelete.classroomId)
    toast.success(
      result.deactivated
        ? `${confirmDelete.classroomName} has duty history, so it was marked Unavailable instead of deleted.`
        : `${confirmDelete.classroomName} deleted.`
    )
    setConfirmDelete(null)
  }

  function exportCsv() {
    downloadCsv(
      'classrooms.csv',
      classrooms.map((c) => ({
        classroom_id: c.classroomId,
        classroom_name: c.classroomName,
        building: c.building,
        floor: c.floor,
        capacity: c.capacity,
        status: c.status
      }))
    )
    toast.success('classrooms.csv downloaded.')
  }

  const columns = [
    { key: 'classroomId', label: 'ID', sortable: true },
    { key: 'classroomName', label: 'Classroom', sortable: true },
    { key: 'building', label: 'Building', sortable: true },
    { key: 'floor', label: 'Floor', sortable: true },
    { key: 'capacity', label: 'Capacity', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => <Badge tone={r.status === 'Available' ? 'green' : 'gray'}>{r.status}</Badge>
    }
  ]

  return (
    <Layout
      title="Classrooms"
      subtitle={`${classrooms.length} classrooms on record`}
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Classroom
          </Button>
        </>
      }
    >
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">All Buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Unavailable">Unavailable</option>
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={openEdit}
          emptyTitle="No classrooms found"
          emptyMessage="Add a classroom manually or import a Classrooms CSV file."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Classroom' : 'Add Classroom'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} type="submit" form="classroom-form">
              Save Classroom
            </Button>
          </>
        }
      >
        <form id="classroom-form" onSubmit={handleSave}>
          <Field label="Classroom ID" required>
            <Input
              value={form.classroomId}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, classroomId: e.target.value }))}
              placeholder="C001"
            />
          </Field>
          <Field label="Classroom Name" required>
            <Input
              value={form.classroomName}
              onChange={(e) => setForm((f) => ({ ...f, classroomName: e.target.value }))}
              placeholder="Room 101"
            />
          </Field>
          <Field label="Building">
            <Input value={form.building} onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))} placeholder="Main Building" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Floor">
              <Input value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} placeholder="1" />
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="40"
              />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
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
              Delete this classroom
            </button>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete classroom?"
        message={`Are you sure you want to delete ${confirmDelete?.classroomName}? If it has duty history, it'll be marked Unavailable instead so past records stay intact.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Layout>
  )
}
