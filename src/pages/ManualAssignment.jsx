import React, { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { Field, Select, Input, TextArea } from '../components/common/Field.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { useDuties, useClassrooms } from '../hooks/useDuties.js'
import { useExams, useExamClassrooms } from '../hooks/useExams.js'
import { useTeachers } from '../hooks/useTeachers.js'
import { manualAssign } from '../services/dutyService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { PenSquare, Save } from 'lucide-react'

export default function ManualAssignment() {
  const duties = useDuties()
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const classrooms = useClassrooms()
  const teachers = useTeachers()
  const toast = useToast()

  const [examId, setExamId] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [selection, setSelection] = useState({ primary1: '', primary2: '', backup: '' })
  const [pendingChange, setPendingChange] = useState(null)
  const [reason, setReason] = useState('')

  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  const availableRooms = examId ? roomsByExam.get(examId) || [] : []

  const currentAssignment = useMemo(() => {
    if (!examId || !classroomId) return null
    const rows = duties.filter((d) => d.examId === examId && d.classroomId === classroomId)
    const primaries = rows.filter((d) => d.role === 'PRIMARY').map((d) => d.teacherId)
    const backup = rows.find((d) => d.role === 'BACKUP')?.teacherId || ''
    return { primary1: primaries[0] || '', primary2: primaries[1] || '', backup }
  }, [duties, examId, classroomId])

  React.useEffect(() => {
    if (currentAssignment) setSelection(currentAssignment)
  }, [currentAssignment])

  const selectedExam = exams.find((e) => e.examId === examId)
  const activeTeachers = teachers.filter((t) => t.status === 'Active')

  function requestChange(role, teacherId) {
    const previousTeacherId = selection[role]
    if (teacherId === previousTeacherId) return
    setPendingChange({ role, teacherId, previousTeacherId })
  }

  async function confirmChange() {
    const { role, teacherId, previousTeacherId } = pendingChange
    const dbRole = role === 'backup' ? 'BACKUP' : 'PRIMARY'
    try {
      await manualAssign({
        examId,
        classroomId,
        role: dbRole,
        teacherId,
        previousTeacherId,
        reason
      })
      setSelection((s) => ({ ...s, [role]: teacherId }))
      toast.success(`${role === 'backup' ? 'Backup' : 'Primary'} teacher updated.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPendingChange(null)
      setReason('')
    }
  }

  const roleLabel = { primary1: 'Primary Teacher 1', primary2: 'Primary Teacher 2', backup: 'Backup Teacher' }

  return (
    <Layout title="Manual Assignment" subtitle="Override automatically generated duties for a specific classroom">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Select classroom" className="lg:col-span-1">
          <Field label="Exam">
            <Select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value)
                setClassroomId('')
              }}
            >
              <option value="">Choose an exam…</option>
              {exams.map((e) => (
                <option key={e.examId} value={e.examId}>
                  {e.subject} — {formatDate(e.date)} {e.shift}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Classroom">
            <Select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} disabled={!examId}>
              <option value="">Choose a classroom…</option>
              {availableRooms.map((id) => (
                <option key={id} value={id}>
                  {classrooms.find((c) => c.classroomId === id)?.classroomName || id}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card title="Current duty assignment" className="lg:col-span-2">
          {!examId || !classroomId ? (
            <EmptyState icon={PenSquare} title="Select an exam and classroom" message="Pick an exam and classroom on the left to view and edit its duty assignment." />
          ) : (
            <div className="space-y-4">
              {selectedExam && (
                <p className="text-sm text-ink-500">
                  {selectedExam.subject} &middot; {formatDate(selectedExam.date)} &middot; {selectedExam.shift} &middot; {classroomId}
                </p>
              )}
              {['primary1', 'primary2', 'backup'].map((role) => (
                <Field key={role} label={roleLabel[role]}>
                  <Select value={selection[role]} onChange={(e) => requestChange(role, e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {activeTeachers.map((t) => (
                      <option key={t.teacherId} value={t.teacherId}>
                        {t.teacherName}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingChange}
        title="Confirm reassignment"
        tone="warning"
        message={
          <div className="space-y-3 w-full">
            <p>
              Change {pendingChange && roleLabel[pendingChange.role]} from{' '}
              <strong>{pendingChange?.previousTeacherId ? teacherLabel(teachers, pendingChange.previousTeacherId) : 'Unassigned'}</strong> to{' '}
              <strong>{pendingChange ? teacherLabel(teachers, pendingChange.teacherId) : ''}</strong>?
            </p>
            <TextArea
              placeholder="Reason for change (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        }
        confirmLabel="Confirm Change"
        onConfirm={confirmChange}
        onCancel={() => {
          setPendingChange(null)
          setReason('')
        }}
      />
    </Layout>
  )
}

function teacherLabel(teachers, id) {
  return teachers.find((t) => t.teacherId === id)?.teacherName || id
}
