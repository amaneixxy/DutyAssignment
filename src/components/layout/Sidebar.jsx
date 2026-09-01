import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, DoorOpen, FileText, CalendarClock, Users, CalendarCheck2,
  UserX, Wand2, ClipboardList, PenSquare, BarChart3, PieChart, AlertOctagon,
  UploadCloud, DownloadCloud, DatabaseBackup, Settings, ChevronDown, ClipboardPen
} from 'lucide-react'

const SECTIONS = [
  {
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }]
  },
  {
    label: 'Exam Management',
    items: [
      { to: '/exams', label: 'Exams', icon: FileText },
      { to: '/classrooms', label: 'Classrooms', icon: DoorOpen },
      { to: '/exam-schedule', label: 'Exam Schedule', icon: CalendarClock }
    ]
  },
  {
    label: 'Teacher Management',
    items: [
      { to: '/teachers', label: 'Teachers', icon: Users },
      { to: '/availability', label: 'Availability', icon: CalendarCheck2 },
      { to: '/absences', label: 'Absences', icon: UserX }
    ]
  },
  {
    label: 'Duty Management',
    items: [
      { to: '/generate-duties', label: 'Generate Duties', icon: Wand2 },
      { to: '/duty-schedule', label: 'Duty Schedule', icon: ClipboardList },
      { to: '/manual-assignment', label: 'Manual Assignment', icon: PenSquare }
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports/teacher-duties', label: 'Teacher Duties', icon: BarChart3 },
      { to: '/reports/workload', label: 'Workload', icon: PieChart },
      { to: '/reports/unassigned', label: 'Unassigned Duties', icon: AlertOctagon }
    ]
  },
  {
    label: 'Data Management',
    items: [
      { to: '/import', label: 'Import CSV', icon: UploadCloud },
      { to: '/export', label: 'Export CSV', icon: DownloadCloud },
      { to: '/backup', label: 'Backup & Restore', icon: DatabaseBackup }
    ]
  },
  {
    items: [{ to: '/settings', label: 'Settings', icon: Settings }]
  }
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-ring ${
          isActive ? 'bg-brand-600 text-white font-medium' : 'text-ink-200 hover:bg-ink-800 hover:text-white'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={onCloseMobile} />
      )}
      <aside
        className={`no-print fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-ink-950 text-white flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-ink-800 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <ClipboardPen size={17} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white leading-none">Duty Desk</p>
            <p className="text-[11px] text-ink-400 mt-0.5">Exam Duty Management</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {SECTIONS.map((section, i) => (
            <div key={i}>
              {section.label && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-ink-800 text-[11px] text-ink-500 shrink-0">
          Runs 100% locally &middot; no server, no login
        </div>
      </aside>
    </>
  )
}
