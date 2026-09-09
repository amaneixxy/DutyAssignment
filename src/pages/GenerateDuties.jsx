import React, { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { Field, Input, Select } from '../components/common/Field.jsx'
import { useExams, useExamClassrooms } from '../hooks/useExams.js'
import { useTeachers } from '../hooks/useTeachers.js'
import { useClassrooms } from '../hooks/useDuties.js'
import { previewDutySchedule, saveDutySchedule } from '../services/dutyService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { Wand2, AlertTriangle, CheckCircle2, RefreshCcw, ClipboardList } from 'lucide-react'

export default function GenerateDuties() {
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const teachers = useTeachers()
  const classrooms = useClassrooms()
  const toast = useToast()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [shifts, setShifts] = useState({ Morning: true, Afternoon: true, Evening: true })
  const [selectedExamIds, setSelectedExamIds] = useState(null) // null = all filtered
  const [preview, setPreview] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (fromDate && e.date < fromDate) return false
      if (toDate && e.date > toDate) return false
      if (!shifts[e.shift]) return false
      return true
    })
  }, [exams, fromDate, toDate, shifts])

  const examIdsToUse = selectedExamIds ?? filteredExams.map((e) => e.examId)

  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  const requiredClassroomSlots = examIdsToUse.reduce((sum, id) => sum + (roomsByExam.get(id)?.length || 0), 0)
  const activeTeacherCount = teachers.filter((t) => t.status === 'Active').length

  async function handleGenerate() {
    if (examIdsToUse.length === 0) {
      toast.error('No exams match your selection.')
      return
    }
    setGenerating(true)
    setPreview(null)
    try {
      const result = await previewDutySchedule({ examIds: examIdsToUse })
      setPreview(result)
      if (result.errors.length > 0) {
        toast.error(result.errors[0].message)
      } else if (result.warnings.length > 0) {
        toast.warning(`Generated with ${result.warnings.length} warning(s). Review before saving.`)
      } else {
        toast.success('Allocation generated. Review and save below.')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!preview || preview.assignments.length === 0) return
    setSaving(true)
    try {
      const result = await saveDutySchedule(preview.assignments)
      toast.success(`Schedule saved: ${result.savedCount} duty assignments recorded.`)
      setPreview(null)
    } catch (e) {
      toast.error(`Could not save schedule: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const roomAssignments = useMemo(() => {
    if (!preview) return []
    const map = new Map()
    for (const a of preview.assignments) {
      if (a.classroomId === 'SHIFT_BACKUP') continue
      const key = `${a.date}|${a.shift}|${a.classroomId}`
      if (!map.has(key)) map.set(key, { date: a.date, shift: a.shift, classroomId: a.classroomId, subject: a.subject, primaries: [] })
      const g = map.get(key)
      if (a.role === 'PRIMARY') g.primaries.push(a.teacherId)
    }
    return [...map.values()].sort((a, b) => (a.date + a.shift + a.classroomId < b.date + b.shift + b.classroomId ? -1 : 1))
  }, [preview])

  const shiftBackupPool = useMemo(() => {
    if (!preview) return []
    const map = new Map()
    for (const a of preview.assignments) {
      if (a.classroomId !== 'SHIFT_BACKUP') continue
      const key = `${a.date}|${a.shift}`
      if (!map.has(key)) map.set(key, { date: a.date, shift: a.shift, teachers: [] })
      map.get(key).teachers.push(a.teacherId)
    }
    return [...map.values()].sort((a, b) => (a.date + a.shift < b.date + b.shift ? -1 : 1))
  }, [preview])

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  return (
    <Layout title="Generate Duties" subtitle="Automatically allocate primary teachers to exam classrooms and generate a 50% shift backup pool">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Step 1 · Date range" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </Field>
          </div>

          <p className="text-sm font-medium text-ink-700 mt-2 mb-2">Step 2 · Shifts</p>
          <div className="flex gap-4 mb-1">
            {['Morning', 'Afternoon', 'Evening'].map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-ink-700">
                <input type="checkbox" checked={shifts[s]} onChange={(e) => setShifts((v) => ({ ...v, [s]: e.target.checked }))} />
                {s}
              </label>
            ))}
          </div>
        </Card>

        <Card title="Step 3 · Summary" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryStat label="Exams" value={examIdsToUse.length} />
            <SummaryStat label="Classroom Slots" value={requiredClassroomSlots} />
            <SummaryStat label="Required Primary" value={requiredClassroomSlots * 2} />
            <SummaryStat label="Available Teachers" value={activeTeacherCount} />
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <Wand2 size={15} /> {generating ? 'Generating…' : 'Generate Teacher Duties'}
          </Button>
        </Card>
      </div>

      {preview && (
        <div className="mt-5 space-y-5">
          <Card
            title="Allocation Preview · Classroom Primary Duties"
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleGenerate} disabled={generating}>
                  <RefreshCcw size={14} /> Generate Again
                </Button>
                <Button onClick={handleSave} disabled={saving || preview.assignments.length === 0}>
                  <CheckCircle2 size={15} /> {saving ? 'Saving…' : 'Save Schedule'}
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <SummaryStat label="Primary Assigned" value={preview.statistics.totalAssignedPrimary} tone="green" />
              <SummaryStat label="Shift Backups Pool" value={preview.statistics.totalAssignedBackup} tone="green" />
              <SummaryStat label="Warnings" value={preview.warnings.length} tone={preview.warnings.length > 0 ? 'amber' : 'green'} />
              <SummaryStat label="Classrooms" value={preview.statistics.classroomsProcessed} />
            </div>

            {preview.warnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3.5 space-y-1.5">
                {preview.warnings.slice(0, 8).map((w, i) => (
                  <p key={i} className="text-sm text-amber-800 flex items-start gap-1.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w.message}
                  </p>
                ))}
                {preview.warnings.length > 8 && (
                  <p className="text-xs text-amber-700">…and {preview.warnings.length - 8} more warning(s).</p>
                )}
              </div>
            )}

            {roomAssignments.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No assignments generated" message="Adjust your selection and try again." />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-ink-500">
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Shift</th>
                      <th className="px-5 py-2.5 font-medium">Room</th>
                      <th className="px-5 py-2.5 font-medium">Subject</th>
                      <th className="px-5 py-2.5 font-medium">Primary 1</th>
                      <th className="px-5 py-2.5 font-medium">Primary 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomAssignments.map((g, i) => (
                      <tr key={i} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-2.5">{formatDate(g.date)}</td>
                        <td className="px-5 py-2.5">{g.shift}</td>
                        <td className="px-5 py-2.5 font-semibold">{g.classroomId}</td>
                        <td className="px-5 py-2.5">{g.subject}</td>
                        <td className="px-5 py-2.5">{g.primaries[0] ? teacherName(g.primaries[0]) : <Badge tone="red">Missing</Badge>}</td>
                        <td className="px-5 py-2.5">{g.primaries[1] ? teacherName(g.primaries[1]) : <Badge tone="red">Missing</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {shiftBackupPool.length > 0 && (
            <Card title="Shift Backup Pool (50% Additional Teachers for Manual Assignment)">
              <p className="text-xs text-ink-500 mb-3">
                These teachers are allocated to each shift's backup pool (50% of shift primary teachers). You can manually assign them from the pool whenever a teacher is absent or needs replacement.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {shiftBackupPool.map((pool, idx) => (
                  <div key={idx} className="p-3 bg-brand-50/50 rounded-lg border border-brand-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-brand-900">
                        {formatDate(pool.date)} &middot; {pool.shift} Shift Pool
                      </span>
                      <Badge tone="brand">{pool.teachers.length} Backup Teachers</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pool.teachers.map((id) => (
                        <span key={id} className="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-brand-200 text-xs font-medium text-ink-800 shadow-xs">
                          {teacherName(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  )
}

const TONE_MAP = {
  green: 'text-emerald-600',
  red: 'text-coral-500',
  amber: 'text-amber-600',
  default: 'text-ink-900'
}

function SummaryStat({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3.5 py-3">
      <p className={`text-xl font-display font-bold ${TONE_MAP[tone]}`}>{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}
