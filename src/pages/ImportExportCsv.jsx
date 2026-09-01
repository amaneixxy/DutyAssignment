import React, { useRef, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import Badge from '../components/common/Badge.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import {
  parseCsvFile,
  validateTeachers,
  validateClassrooms,
  validateExams,
  teacherRowToRecord,
  classroomRowToRecord,
  examRowToRecord
} from '../services/csvService.js'
import { bulkReplaceTeachers, bulkAppendTeachers } from '../services/teacherService.js'
import { bulkReplaceClassrooms, bulkAppendClassrooms } from '../services/classroomService.js'
import { bulkReplaceExams, bulkAppendExams } from '../services/examService.js'
import { useTeachers } from '../hooks/useTeachers.js'
import { useClassrooms } from '../hooks/useDuties.js'
import { useExams } from '../hooks/useExams.js'
import { useToast } from '../components/common/Toast.jsx'
import { UploadCloud, FileWarning, CheckCircle2, Users, DoorOpen, CalendarClock } from 'lucide-react'

const TYPES = {
  teachers: { label: 'Teachers', icon: Users, validate: validateTeachers, toRecord: teacherRowToRecord, idField: 'teacher_id' },
  classrooms: { label: 'Classrooms', icon: DoorOpen, validate: validateClassrooms, toRecord: classroomRowToRecord, idField: 'classroom_id' },
  exams: { label: 'Exam Schedule', icon: CalendarClock, validate: validateExams, toRecord: examRowToRecord, idField: 'exam_id' }
}

export default function ImportExportCsv() {
  const teachers = useTeachers()
  const classrooms = useClassrooms()
  const exams = useExams()
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [activeType, setActiveType] = useState('teachers')
  const [parseResult, setParseResult] = useState(null) // { validRows, invalidRows, missingColumns }
  const [confirmMode, setConfirmMode] = useState(null) // 'replace' | 'append'

  const existingCounts = { teachers: teachers.length, classrooms: classrooms.length, exams: exams.length }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    parseCsvFile(file).then((results) => {
      const { validate } = TYPES[activeType]
      const result = validate(results.data)
      setParseResult(result)
    })
    e.target.value = ''
  }

  async function commitImport(mode) {
    if (!parseResult) return
    const { toRecord } = TYPES[activeType]
    const records = parseResult.validRows.map(toRecord)

    // For exams, split classroom_id (if present) into exam + link rows
    let examLinks = []
    let examRecords = records
    if (activeType === 'exams') {
      examRecords = parseResult.validRows.map((row) => examRowToRecord(row))
      examLinks = parseResult.validRows.filter((r) => r.classroom_id).map((r) => ({ examId: r.exam_id, classroomId: r.classroom_id }))
    }

    try {
      if (activeType === 'teachers') {
        if (mode === 'replace') await bulkReplaceTeachers(records)
        else await bulkAppendTeachers(records)
      } else if (activeType === 'classrooms') {
        if (mode === 'replace') await bulkReplaceClassrooms(records)
        else await bulkAppendClassrooms(records)
      } else if (activeType === 'exams') {
        if (mode === 'replace') await bulkReplaceExams(examRecords, examLinks)
        else await bulkAppendExams(examRecords, examLinks)
      }
      toast.success(`${records.length} ${TYPES[activeType].label.toLowerCase()} imported (${mode}).`)
      setParseResult(null)
      setConfirmMode(null)
    } catch (e) {
      toast.error(`Import failed: ${e.message}`)
    }
  }

  const { icon: ActiveIcon } = TYPES[activeType]

  return (
    <Layout title="Import CSV" subtitle="Upload Teachers, Classrooms, or Exam Schedule CSV files">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="1. Choose data type" className="lg:col-span-1">
          <div className="space-y-2">
            {Object.entries(TYPES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveType(key)
                  setParseResult(null)
                }}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-left border transition-colors focus-ring ${
                  activeType === key ? 'bg-brand-50 border-brand-300 text-brand-800 font-medium' : 'border-ink-200 hover:bg-ink-50 text-ink-700'
                }`}
              >
                <t.icon size={16} />
                {t.label}
                <span className="ml-auto text-xs text-ink-400">{existingCounts[key]} existing</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-500 mb-2">2. Upload CSV file</p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full">
              <UploadCloud size={15} /> Choose {TYPES[activeType].label} CSV
            </Button>
          </div>
        </Card>

        <Card title="3. Preview & validate" className="lg:col-span-2">
          {!parseResult ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-ink-400">
              <ActiveIcon size={28} className="mb-2" />
              <p className="text-sm">Choose a CSV file to see a validation preview here.</p>
            </div>
          ) : (
            <div>
              {parseResult.missingColumns.length > 0 && (
                <div className="mb-4 rounded-md border border-coral-200 bg-coral-50 px-3.5 py-3 text-sm text-coral-700 flex items-start gap-2">
                  <FileWarning size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Missing required column(s): <strong>{parseResult.missingColumns.join(', ')}</strong>. Fix your CSV headers and re-upload.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 size={15} /> {parseResult.validRows.length} valid record(s)
                </span>
                {parseResult.invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <FileWarning size={15} /> {parseResult.invalidRows.length} record(s) with errors
                  </span>
                )}
              </div>

              {parseResult.invalidRows.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-md border border-ink-100 mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50 sticky top-0">
                      <tr className="text-left text-ink-500">
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.invalidRows.map((r) => (
                        <tr key={r.index} className="border-t border-ink-100">
                          <td className="px-3 py-1.5 font-mono">{r.index}</td>
                          <td className="px-3 py-1.5 text-coral-600">{r.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {parseResult.validRows.length > 0 && parseResult.missingColumns.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setConfirmMode('append')}>Import Valid Records (Append)</Button>
                  <Button variant="secondary" onClick={() => setConfirmMode('replace')}>
                    Replace Existing Records
                  </Button>
                  <Button variant="ghost" onClick={() => setParseResult(null)}>
                    Cancel Import
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmMode}
        title={confirmMode === 'replace' ? 'Replace existing records?' : 'Append new records?'}
        message={
          confirmMode === 'replace'
            ? `This will replace all ${existingCounts[activeType]} existing ${TYPES[activeType].label.toLowerCase()} with the ${parseResult?.validRows.length || 0} valid record(s) from this file. This cannot be undone. Continue?`
            : `This will add ${parseResult?.validRows.length || 0} record(s) to the existing ${existingCounts[activeType]} ${TYPES[activeType].label.toLowerCase()}. Records with a matching ID will be overwritten. Continue?`
        }
        confirmLabel={confirmMode === 'replace' ? 'Replace' : 'Append'}
        onConfirm={() => commitImport(confirmMode)}
        onCancel={() => setConfirmMode(null)}
      />
    </Layout>
  )
}
