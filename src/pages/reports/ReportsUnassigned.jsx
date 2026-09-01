import React, { useMemo } from 'react'
import Layout from '../../components/layout/Layout.jsx'
import Card from '../../components/common/Card.jsx'
import Badge from '../../components/common/Badge.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useExams, useExamClassrooms } from '../../hooks/useExams.js'
import { useDuties, useClassrooms } from '../../hooks/useDuties.js'
import { formatDate } from '../../utils/dateUtils.js'
import { CheckCircle2, AlertOctagon } from 'lucide-react'

export default function ReportsUnassigned() {
  const exams = useExams()
  const examClassrooms = useExamClassrooms()
  const classrooms = useClassrooms()
  const duties = useDuties()

  const roomsByExam = useMemo(() => {
    const map = new Map()
    for (const link of examClassrooms) {
      if (!map.has(link.examId)) map.set(link.examId, [])
      map.get(link.examId).push(link.classroomId)
    }
    return map
  }, [examClassrooms])

  const issues = useMemo(() => {
    const list = []

    // Exams with no classroom assigned at all
    for (const exam of exams) {
      const rooms = roomsByExam.get(exam.examId) || []
      if (rooms.length === 0) {
        list.push({ type: 'No classroom assigned', examId: exam.examId, classroomId: '—', detail: `${exam.subject} on ${formatDate(exam.date)} has no classroom.` })
      }
    }

    // Classroom slots missing primary/backup teachers
    for (const exam of exams) {
      const rooms = roomsByExam.get(exam.examId) || []
      for (const classroomId of rooms) {
        const roomDuties = duties.filter((d) => d.examId === exam.examId && d.classroomId === classroomId)
        const primaryCount = roomDuties.filter((d) => d.role === 'PRIMARY').length
        const backupCount = roomDuties.filter((d) => d.role === 'BACKUP').length
        if (primaryCount === 0 && backupCount === 0) continue // not yet generated, not an "issue" per se
        if (primaryCount < 2) {
          list.push({
            type: 'Missing primary teacher',
            examId: exam.examId,
            classroomId,
            detail: `${exam.subject}, ${classroomId} on ${formatDate(exam.date)} ${exam.shift} has only ${primaryCount}/2 primary teachers.`
          })
        }
        if (backupCount < 1) {
          list.push({
            type: 'Missing backup teacher',
            examId: exam.examId,
            classroomId,
            detail: `${exam.subject}, ${classroomId} on ${formatDate(exam.date)} ${exam.shift} has no backup teacher.`
          })
        }
      }
    }

    return list
  }, [exams, roomsByExam, duties])

  return (
    <Layout title="Unassigned Duties Report" subtitle="Classrooms without a full teacher allocation, and exams missing a classroom">
      <Card>
        {issues.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing unassigned"
            message={exams.length === 0 ? 'Add or import exams first.' : 'Every generated duty has its required teachers.'}
          />
        ) : (
          <ul className="divide-y divide-ink-50">
            {issues.map((issue, i) => (
              <li key={i} className="py-2.5 flex items-start gap-2.5 text-sm">
                <AlertOctagon size={16} className="text-coral-500 mt-0.5 shrink-0" />
                <div>
                  <Badge tone="red">{issue.type}</Badge>
                  <p className="text-ink-700 mt-1">{issue.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  )
}
