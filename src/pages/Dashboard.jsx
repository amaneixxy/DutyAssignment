import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { useTeachers } from '../hooks/useTeachers.js'
import { useExams } from '../hooks/useExams.js'
import { useDuties, useClassrooms } from '../hooks/useDuties.js'
import { deriveTeacherDutyCounts } from '../algorithms/dutyAllocation.js'
import { loadDemoData } from '../services/demoData.js'
import { useToast } from '../components/common/Toast.jsx'
import { Users, DoorOpen, CalendarClock, ClipboardCheck, ShieldAlert, ClipboardX, Sparkles, LayoutDashboard } from 'lucide-react'

const STAT_ICONS = [Users, Users, DoorOpen, CalendarClock, ClipboardCheck, ClipboardX, ShieldAlert]

const TONE_CLASSES = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600'
}

function StatCard({ label, value, icon: Icon, tone = 'brand' }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card p-4 flex items-center gap-3.5">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${TONE_CLASSES[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-bold text-ink-900 leading-tight">{value}</p>
        <p className="text-xs text-ink-500 truncate">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const teachers = useTeachers()
  const classrooms = useClassrooms()
  const exams = useExams()
  const duties = useDuties()
  const toast = useToast()
  const navigate = useNavigate()
  const [loadingDemo, setLoadingDemo] = useState(false)

  const stats = useMemo(() => {
    const activeTeachers = teachers.filter((t) => t.status === 'Active')
    const primary = duties.filter((d) => d.role === 'PRIMARY')
    const backup = duties.filter((d) => d.role === 'BACKUP')
    return {
      totalTeachers: teachers.length,
      activeTeachers: activeTeachers.length,
      totalClassrooms: classrooms.length,
      upcomingExams: exams.length,
      assignedDuties: primary.length,
      unassignedDuties: 0,
      backupDuties: backup.length
    }
  }, [teachers, classrooms, exams, duties])

  const dutyRows = useMemo(() => {
    const map = deriveTeacherDutyCounts(teachers, duties)
    const byId = new Map(teachers.map((t) => [t.teacherId, t]))
    return [...map.values()]
      .filter((r) => r.total > 0)
      .map((r) => ({ ...r, name: byId.get(r.teacherId)?.teacherName || r.teacherId }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [teachers, duties])

  const maxTotal = Math.max(1, ...dutyRows.map((r) => r.total))
  const hasAnyData = teachers.length > 0 || classrooms.length > 0 || exams.length > 0

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      const result = await loadDemoData()
      toast.success(`Demo data loaded: ${result.teacherCount} teachers, ${result.classroomCount} classrooms, ${result.examCount} exams.`)
    } catch (e) {
      toast.error(`Could not load demo data: ${e.message}`)
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <Layout
      title="Dashboard"
      subtitle="Overview of teachers, classrooms, exams and duty allocation"
      actions={
        !hasAnyData && (
          <Button onClick={handleLoadDemo} disabled={loadingDemo}>
            <Sparkles size={15} /> {loadingDemo ? 'Loading…' : 'Load Demo Data'}
          </Button>
        )
      }
    >
      {!hasAnyData ? (
        <Card>
          <EmptyState
            icon={LayoutDashboard}
            title="Nothing here yet"
            message="Import your teacher, classroom and exam CSV files to get started, or load demo data to explore the app end-to-end."
            action={
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate('/import')} variant="secondary">
                  Import CSV files
                </Button>
                <Button onClick={handleLoadDemo} disabled={loadingDemo}>
                  <Sparkles size={15} /> {loadingDemo ? 'Loading…' : 'Load Demo Data'}
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            <StatCard label="Total Teachers" value={stats.totalTeachers} icon={Users} tone="brand" />
            <StatCard label="Active Teachers" value={stats.activeTeachers} icon={Users} tone="brand" />
            <StatCard label="Total Classrooms" value={stats.totalClassrooms} icon={DoorOpen} tone="brand" />
            <StatCard label="Upcoming Exams" value={stats.upcomingExams} icon={CalendarClock} tone="brand" />
            <StatCard label="Assigned Duties" value={stats.assignedDuties} icon={ClipboardCheck} tone="brand" />
            <StatCard label="Backup Duties" value={stats.backupDuties} icon={ShieldAlert} tone="amber" />
          </div>

          <Card
            title="Teacher Duty Distribution"
            action={
              <Button variant="ghost" onClick={() => navigate('/reports/workload')} className="text-xs">
                View full report
              </Button>
            }
          >
            {dutyRows.length === 0 ? (
              <EmptyState
                title="No duties generated yet"
                message="Once you generate duties, the busiest teachers will appear here."
              />
            ) : (
              <div className="space-y-3">
                {dutyRows.map((r) => (
                  <div key={r.teacherId} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm text-ink-700 truncate">{r.name}</span>
                    <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden flex">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${(r.primary / maxTotal) * 100}%` }}
                        title={`${r.primary} primary`}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(r.backup / maxTotal) * 100}%` }}
                        title={`${r.backup} backup`}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-ink-800">{r.total}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Primary
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Backup
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </Layout>
  )
}
