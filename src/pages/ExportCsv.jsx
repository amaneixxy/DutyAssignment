import React from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import { useTeachers } from '../hooks/useTeachers.js'
import { useClassrooms, useDuties } from '../hooks/useDuties.js'
import { useExams } from '../hooks/useExams.js'
import { deriveTeacherDutyCounts } from '../algorithms/dutyAllocation.js'
import { downloadCsv } from '../services/csvService.js'
import { useToast } from '../components/common/Toast.jsx'
import { Download, Users, DoorOpen, CalendarClock, ClipboardList, BarChart3, ShieldCheck } from 'lucide-react'

export default function ExportCsv() {
  const teachers = useTeachers()
  const classrooms = useClassrooms()
  const exams = useExams()
  const duties = useDuties()
  const toast = useToast()

  const teacherName = (id) => teachers.find((t) => t.teacherId === id)?.teacherName || id

  function exportTeachers() {
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

  function exportClassrooms() {
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

  function exportExams() {
    downloadCsv(
      'exams.csv',
      exams.map((e) => ({
        exam_id: e.examId,
        date: e.date,
        day: e.day,
        shift: e.shift,
        start_time: e.startTime,
        end_time: e.endTime,
        subject: e.subject
      }))
    )
    toast.success('exams.csv downloaded.')
  }

  function exportDutySchedule() {
    downloadCsv(
      'duty_schedule.csv',
      duties.map((d) => ({
        date: d.date,
        shift: d.shift,
        classroom: d.classroomId,
        subject: d.subject,
        teacher: teacherName(d.teacherId),
        role: d.role,
        assignment_type: d.assignmentType
      }))
    )
    toast.success('duty_schedule.csv downloaded.')
  }

  function exportTeacherSummary() {
    const map = deriveTeacherDutyCounts(teachers, duties)
    downloadCsv(
      'teacher_duty_summary.csv',
      [...map.values()].map((r) => ({
        teacher_id: r.teacherId,
        teacher_name: teacherName(r.teacherId),
        primary_duties: r.primary,
        backup_duties: r.backup,
        total_duties: r.total
      }))
    )
    toast.success('teacher_duty_summary.csv downloaded.')
  }

  function exportBackupAssignments() {
    downloadCsv(
      'backup_assignments.csv',
      duties
        .filter((d) => d.role === 'BACKUP')
        .map((d) => ({
          date: d.date,
          shift: d.shift,
          classroom: d.classroomId,
          subject: d.subject,
          backup_teacher: teacherName(d.teacherId)
        }))
    )
    toast.success('backup_assignments.csv downloaded.')
  }

  const exportsList = [
    { icon: Users, label: 'Teachers', file: 'teachers.csv', count: teachers.length, onClick: exportTeachers },
    { icon: DoorOpen, label: 'Classrooms', file: 'classrooms.csv', count: classrooms.length, onClick: exportClassrooms },
    { icon: CalendarClock, label: 'Exams', file: 'exams.csv', count: exams.length, onClick: exportExams },
    { icon: ClipboardList, label: 'Duty Schedule', file: 'duty_schedule.csv', count: duties.length, onClick: exportDutySchedule },
    { icon: BarChart3, label: 'Teacher Duty Summary', file: 'teacher_duty_summary.csv', count: teachers.length, onClick: exportTeacherSummary },
    { icon: ShieldCheck, label: 'Backup Assignments', file: 'backup_assignments.csv', count: duties.filter((d) => d.role === 'BACKUP').length, onClick: exportBackupAssignments }
  ]

  return (
    <Layout title="Export CSV" subtitle="Download your data as CSV files for backup or use in other tools">
      <div className="grid sm:grid-cols-2 gap-4">
        {exportsList.map((item) => (
          <Card key={item.file}>
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <item.icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900">{item.label}</p>
                <p className="text-xs text-ink-500">
                  {item.file} &middot; {item.count} records
                </p>
              </div>
              <Button variant="secondary" onClick={item.onClick} disabled={item.count === 0}>
                <Download size={15} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  )
}
