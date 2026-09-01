import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { getTeacher, getTeacherDutyHistory } from '../services/teacherService.js'
import { formatDate } from '../utils/dateUtils.js'
import { ArrowLeft, History, Mail, Phone, Building2 } from 'lucide-react'

export default function TeacherDetails() {
  const { teacherId } = useParams()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([getTeacher(teacherId), getTeacherDutyHistory(teacherId)]).then(([t, h]) => {
      if (!mounted) return
      setTeacher(t)
      setHistory(h)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [teacherId])

  const primary = history.filter((h) => h.role === 'PRIMARY').length
  const backup = history.filter((h) => h.role === 'BACKUP').length

  if (loading) return null

  if (!teacher) {
    return (
      <Layout title="Teacher not found">
        <Card>
          <EmptyState title="Teacher not found" message={`No teacher with ID "${teacherId}" exists.`} />
        </Card>
      </Layout>
    )
  }

  return (
    <Layout
      title={teacher.teacherName}
      subtitle={`Teacher ID: ${teacher.teacherId}`}
      actions={
        <Button variant="secondary" onClick={() => navigate('/teachers')}>
          <ArrowLeft size={15} /> Back to Teachers
        </Button>
      }
    >
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge tone={teacher.status === 'Active' ? 'green' : 'gray'}>{teacher.status}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Building2 size={15} className="text-ink-400" /> {teacher.department || '—'}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Mail size={15} className="text-ink-400" /> {teacher.email || '—'}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Phone size={15} className="text-ink-400" /> {teacher.phone || '—'}
            </div>
            <hr className="border-ink-100" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-display font-bold text-ink-900">{primary}</p>
                <p className="text-xs text-ink-500">Primary</p>
              </div>
              <div>
                <p className="text-xl font-display font-bold text-ink-900">{backup}</p>
                <p className="text-xs text-ink-500">Backup</p>
              </div>
              <div>
                <p className="text-xl font-display font-bold text-brand-600">{history.length}</p>
                <p className="text-xs text-ink-500">Total</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Duty History" action={<History size={16} className="text-ink-400" />}>
          {history.length === 0 ? (
            <EmptyState title="No duties yet" message="This teacher has not been assigned to any exam duty." />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-ink-500">
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium">Shift</th>
                    <th className="px-5 py-2.5 font-medium">Classroom</th>
                    <th className="px-5 py-2.5 font-medium">Subject</th>
                    <th className="px-5 py-2.5 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-2.5">{formatDate(h.date)}</td>
                      <td className="px-5 py-2.5">{h.shift}</td>
                      <td className="px-5 py-2.5">{h.classroomId}</td>
                      <td className="px-5 py-2.5">{h.subject}</td>
                      <td className="px-5 py-2.5">
                        <Badge tone={h.role === 'PRIMARY' ? 'blue' : 'amber'}>{h.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
