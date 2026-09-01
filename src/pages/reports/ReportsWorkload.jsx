import React, { useMemo } from 'react'
import Layout from '../../components/layout/Layout.jsx'
import Card from '../../components/common/Card.jsx'
import Badge from '../../components/common/Badge.jsx'
import { useTeachers } from '../../hooks/useTeachers.js'
import { useDuties, useClassrooms } from '../../hooks/useDuties.js'
import { deriveTeacherDutyCounts } from '../../algorithms/dutyAllocation.js'
import { formatDate } from '../../utils/dateUtils.js'
import EmptyState from '../../components/common/EmptyState.jsx'
import { PieChart } from 'lucide-react'

export default function ReportsWorkload() {
  const teachers = useTeachers()
  const duties = useDuties()
  const classrooms = useClassrooms()

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  const { most, least } = useMemo(() => {
    const map = deriveTeacherDutyCounts(teachers, duties)
    const list = [...map.values()].filter((r) => teachers.some((t) => t.teacherId === r.teacherId && t.status === 'Active'))
    const sorted = [...list].sort((a, b) => b.total - a.total)
    return { most: sorted.slice(0, 5), least: [...list].sort((a, b) => a.total - b.total).slice(0, 5) }
  }, [teachers, duties])

  const dateWise = useMemo(() => {
    const map = new Map()
    for (const d of duties) {
      const key = `${d.date}|${d.shift}`
      if (!map.has(key)) map.set(key, { date: d.date, shift: d.shift, total: 0, teacherSet: new Set() })
      const rec = map.get(key)
      rec.total++
      rec.teacherSet.add(d.teacherId)
    }
    return [...map.values()].sort((a, b) => (a.date + a.shift < b.date + b.shift ? -1 : 1))
  }, [duties])

  const classroomWise = useMemo(() => {
    const map = new Map()
    for (const d of duties) {
      if (!map.has(d.classroomId)) map.set(d.classroomId, { classroomId: d.classroomId, examSet: new Set(), teacherSet: new Set() })
      const rec = map.get(d.classroomId)
      rec.examSet.add(d.examId)
      rec.teacherSet.add(d.teacherId)
    }
    return [...map.values()].sort((a, b) => (a.classroomId < b.classroomId ? -1 : 1))
  }, [duties])

  if (duties.length === 0) {
    return (
      <Layout title="Workload Report" subtitle="Most and least assigned teachers, date-wise and classroom-wise breakdowns">
        <Card>
          <EmptyState icon={PieChart} title="No duty data yet" message="Generate duties to populate this report." />
        </Card>
      </Layout>
    )
  }

  return (
    <Layout title="Workload Report" subtitle="Most and least assigned teachers, date-wise and classroom-wise breakdowns">
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Card title="Most assigned teachers">
          <ul className="divide-y divide-ink-50">
            {most.map((r) => (
              <li key={r.teacherId} className="flex items-center justify-between py-2 text-sm">
                <span>{teacherName(r.teacherId)}</span>
                <Badge tone="blue">{r.total} duties</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Least assigned teachers">
          <ul className="divide-y divide-ink-50">
            {least.map((r) => (
              <li key={r.teacherId} className="flex items-center justify-between py-2 text-sm">
                <span>{teacherName(r.teacherId)}</span>
                <Badge tone="gray">{r.total} duties</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Date-wise report">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-ink-500">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Shift</th>
                  <th className="px-5 py-2 font-medium">Total Duties</th>
                  <th className="px-5 py-2 font-medium">Teachers</th>
                </tr>
              </thead>
              <tbody>
                {dateWise.map((r, i) => (
                  <tr key={i} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-2">{formatDate(r.date)}</td>
                    <td className="px-5 py-2">{r.shift}</td>
                    <td className="px-5 py-2">{r.total}</td>
                    <td className="px-5 py-2">{r.teacherSet.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Classroom-wise report">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-ink-500">
                  <th className="px-5 py-2 font-medium">Classroom</th>
                  <th className="px-5 py-2 font-medium">Exam Count</th>
                  <th className="px-5 py-2 font-medium">Assigned Teachers</th>
                </tr>
              </thead>
              <tbody>
                {classroomWise.map((r) => (
                  <tr key={r.classroomId} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-2">{classrooms.find((c) => c.classroomId === r.classroomId)?.classroomName || r.classroomId}</td>
                    <td className="px-5 py-2">{r.examSet.size}</td>
                    <td className="px-5 py-2">{r.teacherSet.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
