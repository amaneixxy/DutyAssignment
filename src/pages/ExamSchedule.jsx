import React, { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { useExams, useExamClassrooms } from '../hooks/useExams.js'
import { useClassrooms } from '../hooks/useDuties.js'
import { setExamClassrooms } from '../services/examService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { CalendarClock, Check } from 'lucide-react'

export default function ExamSchedule() {
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const classrooms = useClassrooms()
  const toast = useToast()
  const [selections, setSelections] = useState({})

  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  const unassigned = useMemo(() => exams.filter((e) => (roomsByExam.get(e.examId) || []).length === 0), [exams, roomsByExam])
  const assigned = useMemo(() => exams.filter((e) => (roomsByExam.get(e.examId) || []).length > 0), [exams, roomsByExam])

  function toggle(examId, classroomId) {
    setSelections((s) => {
      const current = new Set(s[examId] || [])
      if (current.has(classroomId)) current.delete(classroomId)
      else current.add(classroomId)
      return { ...s, [examId]: [...current] }
    })
  }

  async function saveAssignment(examId) {
    const ids = selections[examId] || []
    if (ids.length === 0) {
      toast.error('Select at least one classroom.')
      return
    }
    await setExamClassrooms(examId, ids)
    toast.success(`Classrooms assigned for ${examId}.`)
  }

  return (
    <Layout title="Exam Schedule" subtitle="Assign classrooms to exams that don't have one yet">
      {unassigned.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Every exam has classrooms assigned"
            message={exams.length === 0 ? 'Import or add exams first.' : 'You can review current assignments below.'}
          />
        </Card>
      ) : (
        <div className="space-y-4 mb-6">
          {unassigned.map((exam) => (
            <Card key={exam.examId}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium text-ink-900">
                    {exam.subject} <span className="text-ink-400 font-normal">— {exam.examId}</span>
                  </p>
                  <p className="text-sm text-ink-500">
                    {formatDate(exam.date)} &middot; {exam.shift} &middot; {exam.startTime}–{exam.endTime}
                  </p>
                </div>
                <Badge tone="amber">No classroom</Badge>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {classrooms
                  .filter((c) => c.status === 'Available')
                  .map((c) => {
                    const isSelected = (selections[exam.examId] || []).includes(c.classroomId)
                    return (
                      <button
                        key={c.classroomId}
                        onClick={() => toggle(exam.examId, c.classroomId)}
                        className={`text-sm px-3 py-1.5 rounded-md border transition-colors focus-ring ${
                          isSelected
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
                        }`}
                      >
                        {isSelected && <Check size={12} className="inline mr-1" />}
                        {c.classroomName}
                      </button>
                    )
                  })}
              </div>
              <Button onClick={() => saveAssignment(exam.examId)}>Save Classroom Assignment</Button>
            </Card>
          ))}
        </div>
      )}

      {assigned.length > 0 && (
        <Card title="Already Assigned">
          <div className="divide-y divide-ink-50">
            {assigned.map((exam) => (
              <div key={exam.examId} className="py-2.5 flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium text-ink-800">{exam.subject}</span>{' '}
                  <span className="text-ink-400">
                    &middot; {formatDate(exam.date)} &middot; {exam.shift}
                  </span>
                </span>
                <span className="text-ink-600">{(roomsByExam.get(exam.examId) || []).join(', ')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Layout>
  )
}
