import React, { useMemo } from 'react'
import Layout from '../../components/layout/Layout.jsx'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import DataTable from '../../components/tables/DataTable.jsx'
import { useTeachers } from '../../hooks/useTeachers.js'
import { useDuties } from '../../hooks/useDuties.js'
import { deriveTeacherDutyCounts } from '../../algorithms/dutyAllocation.js'
import { downloadCsv } from '../../services/csvService.js'
import { useToast } from '../../components/common/Toast.jsx'
import { Download, Printer } from 'lucide-react'

export default function ReportsTeacherDuties() {
  const teachers = useTeachers()
  const duties = useDuties()
  const toast = useToast()

  const rows = useMemo(() => {
    const map = deriveTeacherDutyCounts(teachers, duties)
    return [...map.values()]
      .map((r) => {
        const t = teachers.find((x) => x.teacherId === r.teacherId)
        return { ...r, teacherName: t?.teacherName || r.teacherId, department: t?.department || '—' }
      })
      .sort((a, b) => b.total - a.total)
  }, [teachers, duties])

  function exportCsv() {
    downloadCsv(
      'teacher_duty_summary.csv',
      rows.map((r) => ({
        teacher_id: r.teacherId,
        teacher_name: r.teacherName,
        department: r.department,
        primary_duties: r.primary,
        backup_duties: r.backup,
        total_duties: r.total
      }))
    )
    toast.success('teacher_duty_summary.csv downloaded.')
  }

  const columns = [
    { key: 'teacherName', label: 'Teacher', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'primary', label: 'Primary', sortable: true },
    { key: 'backup', label: 'Backup', sortable: true },
    { key: 'total', label: 'Total', sortable: true }
  ]

  return (
    <Layout
      title="Teacher Duty Report"
      subtitle="Primary, backup, and total duty counts per teacher"
      actions={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
        </>
      }
    >
      <Card>
        <DataTable columns={columns} rows={rows} pageSize={20} emptyTitle="No duty data yet" emptyMessage="Generate duties to see this report." />
      </Card>
    </Layout>
  )
}
