import React, { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { Field, Input, Select } from '../components/common/Field.jsx'
import DataTable from '../components/tables/DataTable.jsx'
import { useDuties, useClassrooms } from '../hooks/useDuties.js'
import { useTeachers } from '../hooks/useTeachers.js'
import { regenerateDuties, saveDutySchedule } from '../services/dutyService.js'
import { downloadCsv } from '../services/csvService.js'
import { useToast } from '../components/common/Toast.jsx'
import { formatDate } from '../utils/dateUtils.js'
import { Printer, Download, RefreshCcw } from 'lucide-react'

export default function DutySchedule() {
  const duties = useDuties()
  const teachers = useTeachers()
  const classrooms = useClassrooms()
  const toast = useToast()

  const [dateFilter, setDateFilter] = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [classroomFilter, setClassroomFilter] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  // Group duties by exam+classroom+slot into one row with Teacher1/2/Backup
  const rows = useMemo(() => {
    const map = new Map()
    for (const d of duties) {
      const key = `${d.examId}|${d.classroomId}`
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          date: d.date,
          shift: d.shift,
          startTime: d.startTime,
          endTime: d.endTime,
          classroomId: d.classroomId,
          subject: d.subject,
          examId: d.examId,
          teacher1: null,
          teacher2: null,
          backup: null
        })
      }
      const row = map.get(key)
      if (d.role === 'PRIMARY') {
        if (!row.teacher1) row.teacher1 = d.teacherId
        else row.teacher2 = d.teacherId
      } else {
        row.backup = d.teacherId
      }
    }
    return [...map.values()]
      .filter((r) => !dateFilter || r.date === dateFilter)
      .filter((r) => !shiftFilter || r.shift === shiftFilter)
      .filter((r) => !classroomFilter || r.classroomId === classroomFilter)
      .filter((r) => !teacherFilter || [r.teacher1, r.teacher2, r.backup].includes(teacherFilter))
      .sort((a, b) => (a.date + a.shift + a.classroomId < b.date + b.shift + b.classroomId ? -1 : 1))
  }, [duties, dateFilter, shiftFilter, classroomFilter, teacherFilter])

  async function handleRegenerate() {
    setConfirmRegen(false)
    const result = await regenerateDuties({ scope: 'ALL' })
    if (result.errors.length > 0) {
      toast.error(result.errors[0].message)
      return
    }
    await saveDutySchedule(result.assignments)
    toast.success(`Duties regenerated: ${result.assignments.length} assignments recalculated.`)
  }

  function exportCsv() {
    downloadCsv(
      'duty_schedule.csv',
      rows.map((r) => ({
        date: r.date,
        shift: r.shift,
        classroom: r.classroomId,
        subject: r.subject,
        teacher_1: r.teacher1 ? teacherName(r.teacher1) : '',
        teacher_2: r.teacher2 ? teacherName(r.teacher2) : '',
        backup: r.backup ? teacherName(r.backup) : ''
      }))
    )
    toast.success('duty_schedule.csv downloaded.')
  }

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'shift', label: 'Shift', sortable: true },
    { key: 'startTime', label: 'Time', render: (r) => `${r.startTime}–${r.endTime}` },
    { key: 'classroomId', label: 'Classroom', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'teacher1', label: 'Teacher 1', render: (r) => (r.teacher1 ? teacherName(r.teacher1) : <Badge tone="red">Missing</Badge>) },
    { key: 'teacher2', label: 'Teacher 2', render: (r) => (r.teacher2 ? teacherName(r.teacher2) : <Badge tone="red">Missing</Badge>) },
    { key: 'backup', label: 'Backup', render: (r) => (r.backup ? teacherName(r.backup) : <Badge tone="amber">Missing</Badge>) }
  ]

  return (
    <Layout
      title="Duty Schedule"
      subtitle={`${rows.length} classroom assignments`}
      actions={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
          <Button variant="danger" onClick={() => setConfirmRegen(true)}>
            <RefreshCcw size={15} /> Regenerate All
          </Button>
        </>
      }
    >
      <Card className="no-print">
        <div className="flex flex-wrap gap-2 mb-4">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto" />
          <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="w-auto min-w-[130px]">
            <option value="">All Shifts</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
          </Select>
          <Select value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">All Classrooms</option>
            {classrooms.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.classroomName}
              </option>
            ))}
          </Select>
          <Select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="w-auto min-w-[160px]">
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.teacherId} value={t.teacherId}>
                {t.teacherName}
              </option>
            ))}
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          emptyTitle="No duties generated yet"
          emptyMessage="Go to Generate Duties to create the schedule."
        />
      </Card>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate all duties?"
        message={`Existing duty assignments will be affected. Current assignments: ${duties.length}. This recalculates every exam's teacher allocation from scratch. Continue?`}
        confirmLabel="Regenerate All"
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </Layout>
  )
}
