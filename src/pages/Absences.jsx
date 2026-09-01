import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import { Field, Select, Input, TextArea } from '../components/common/Field.jsx'
import DataTable from '../components/tables/DataTable.jsx'
import { useTeachers } from '../hooks/useTeachers.js'
import { useDuties } from '../hooks/useDuties.js'
import { db } from '../services/db.js'
import { recordAbsence } from '../services/dutyService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { UserX } from 'lucide-react'

export default function Absences() {
  const teachers = useTeachers()
  const duties = useDuties()
  const absences = useLiveQuery(() => db.absences.orderBy('createdAt').reverse().toArray(), [], []) || []
  const toast = useToast()

  const [form, setForm] = useState({ teacherId: '', date: '', shift: 'Morning', reason: '' })
  const [lastResult, setLastResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  const affectedPreview = useMemo(() => {
    if (!form.teacherId || !form.date) return []
    return duties.filter((d) => d.teacherId === form.teacherId && d.date === form.date && d.shift === form.shift)
  }, [duties, form.teacherId, form.date, form.shift])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.teacherId || !form.date) {
      toast.error('Teacher and date are required.')
      return
    }
    if (affectedPreview.length === 0) {
      toast.warning('This teacher has no duty on that date/shift, but the absence will still be recorded.')
    }
    setSubmitting(true)
    try {
      const result = await recordAbsence(form)
      setLastResult(result)
      if (result.errors.length > 0) {
        toast.warning(`Absence recorded, but ${result.errors.length} issue(s) need attention. See below.`)
      } else {
        toast.success('Absence recorded and duties reassigned automatically.')
      }
      setForm((f) => ({ ...f, date: '', reason: '' }))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { key: 'teacherId', label: 'Teacher', sortable: true, render: (r) => teacherName(r.teacherId) },
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'shift', label: 'Shift', sortable: true },
    { key: 'reason', label: 'Reason' }
  ]

  return (
    <Layout title="Teacher Absences" subtitle="Record an absence — the backup teacher is automatically promoted and a new backup is assigned">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Record absence" className="lg:col-span-1">
          <form onSubmit={handleSubmit}>
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
            <Field label="Reason">
              <TextArea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Sick leave" />
            </Field>

            {affectedPreview.length > 0 && (
              <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                This will affect {affectedPreview.length} duty assignment(s) on {formatDate(form.date)} ({form.shift}).
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              <UserX size={15} /> {submitting ? 'Processing…' : 'Record Absence & Reassign'}
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          {lastResult && (
            <Card title="Reassignment result">
              {lastResult.historyEntries.length === 0 && lastResult.errors.length === 0 && (
                <p className="text-sm text-ink-500">No duties needed reassignment for this absence.</p>
              )}
              <ul className="space-y-1.5">
                {lastResult.historyEntries.map((h, i) => (
                  <li key={i} className="text-sm text-ink-700 flex items-start gap-1.5">
                    <Badge tone="blue">{h.action.replace(/_/g, ' ')}</Badge>
                    <span>{h.detail}</span>
                  </li>
                ))}
              </ul>
              {lastResult.errors.map((e, i) => (
                <p key={i} className="text-sm text-coral-600 mt-1.5">
                  ⚠ {e.message}
                </p>
              ))}
            </Card>
          )}

          <Card title="Absence history">
            <DataTable
              columns={columns}
              rows={absences}
              emptyTitle="No absences recorded"
              emptyMessage="Recorded absences and their automatic reassignments will appear here."
            />
          </Card>
        </div>
      </div>
    </Layout>
  )
}
