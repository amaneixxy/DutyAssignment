import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import { Field, Select, Input, TextArea } from '../components/common/Field.jsx'
import DataTable from '../components/tables/DataTable.jsx'
import { useTeachers } from '../hooks/useTeachers.js'
import { db, logHistory } from '../services/db.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { Plus, Trash2 } from 'lucide-react'

export default function Availability() {
  const teachers = useTeachers()
  const records = useLiveQuery(() => db.teacherAvailability.toArray(), [], []) || []
  const toast = useToast()

  const [form, setForm] = useState({ teacherId: '', date: '', shift: 'Morning', status: 'Unavailable', reason: '' })

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.teacherId || !form.date) {
      toast.error('Teacher and date are required.')
      return
    }
    await db.teacherAvailability.add({ ...form })
    await logHistory({
      teacherId: form.teacherId,
      action: 'AVAILABILITY_SET',
      detail: `${form.teacherId} marked ${form.status} on ${form.date} ${form.shift}`
    })
    toast.success('Availability recorded.')
    setForm((f) => ({ ...f, date: '', reason: '' }))
  }

  async function handleDelete(id) {
    await db.teacherAvailability.delete(id)
    toast.success('Availability entry removed.')
  }

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  const columns = [
    { key: 'teacherId', label: 'Teacher', sortable: true, render: (r) => teacherName(r.teacherId) },
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'shift', label: 'Shift', sortable: true },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Available' ? 'green' : 'red'}>{r.status}</Badge> },
    { key: 'reason', label: 'Reason' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button onClick={() => handleDelete(r.id)} className="text-ink-400 hover:text-coral-500 focus-ring rounded" aria-label="Remove">
          <Trash2 size={15} />
        </button>
      )
    }
  ]

  return (
    <Layout title="Teacher Availability" subtitle="Mark teachers unavailable for specific dates/shifts — they'll be excluded from allocation">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Add availability entry" className="lg:col-span-1">
          <form onSubmit={handleAdd}>
            <Field label="Teacher" required>
              <Select value={form.teacherId} onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}>
                <option value="">Select teacher…</option>
                {teachers.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName}
                  </option>
                ))}
              </Select>
            </Field>
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
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="Unavailable">Unavailable</option>
                <option value="Available">Available</option>
              </Select>
            </Field>
            <Field label="Reason">
              <TextArea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Personal leave" />
            </Field>
            <Button type="submit" className="w-full">
              <Plus size={15} /> Add Entry
            </Button>
          </form>
        </Card>

        <Card title="All availability entries" className="lg:col-span-2">
          <DataTable
            columns={columns}
            rows={records}
            emptyTitle="No availability entries"
            emptyMessage="All active teachers are assumed available unless marked otherwise here."
          />
        </Card>
      </div>
    </Layout>
  )
}
