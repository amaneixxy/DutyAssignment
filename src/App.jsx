import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ensureDefaultSettings } from './services/db.js'

import Dashboard from './pages/Dashboard.jsx'
import Teachers from './pages/Teachers.jsx'
import TeacherDetails from './pages/TeacherDetails.jsx'
import Classrooms from './pages/Classrooms.jsx'
import Exams from './pages/Exams.jsx'
import ExamSchedule from './pages/ExamSchedule.jsx'
import GenerateDuties from './pages/GenerateDuties.jsx'
import DutySchedule from './pages/DutySchedule.jsx'
import ManualAssignment from './pages/ManualAssignment.jsx'
import Availability from './pages/Availability.jsx'
import Absences from './pages/Absences.jsx'
import ReportsTeacherDuties from './pages/reports/ReportsTeacherDuties.jsx'
import ReportsWorkload from './pages/reports/ReportsWorkload.jsx'
import ReportsUnassigned from './pages/reports/ReportsUnassigned.jsx'
import ImportExportCsv from './pages/ImportExportCsv.jsx'
import ExportCsv from './pages/ExportCsv.jsx'
import BackupRestore from './pages/BackupRestore.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureDefaultSettings().finally(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/teachers" element={<Teachers />} />
      <Route path="/teachers/:teacherId" element={<TeacherDetails />} />
      <Route path="/classrooms" element={<Classrooms />} />
      <Route path="/exams" element={<Exams />} />
      <Route path="/exam-schedule" element={<ExamSchedule />} />
      <Route path="/generate-duties" element={<GenerateDuties />} />
      <Route path="/duty-schedule" element={<DutySchedule />} />
      <Route path="/manual-assignment" element={<ManualAssignment />} />
      <Route path="/availability" element={<Availability />} />
      <Route path="/absences" element={<Absences />} />
      <Route path="/reports/teacher-duties" element={<ReportsTeacherDuties />} />
      <Route path="/reports/workload" element={<ReportsWorkload />} />
      <Route path="/reports/unassigned" element={<ReportsUnassigned />} />
      <Route path="/import" element={<ImportExportCsv />} />
      <Route path="/export" element={<ExportCsv />} />
      <Route path="/backup" element={<BackupRestore />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
