import React, { useRef, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { exportAllData, importBackup } from '../services/backupService.js'
import { clearAllData } from '../services/db.js'
import { useToast } from '../components/common/Toast.jsx'
import { DatabaseBackup, UploadCloud, Trash2, DownloadCloud } from 'lucide-react'

export default function BackupRestore() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleExport() {
    await exportAllData()
    toast.success('Backup file downloaded.')
  }

  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImportFile(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!pendingImportFile) return
    try {
      const text = await pendingImportFile.text()
      const payload = await importBackup(text)
      toast.success(
        `Backup restored: ${payload.teachers?.length || 0} teachers, ${payload.classrooms?.length || 0} classrooms, ${payload.exams?.length || 0} exams, ${payload.duties?.length || 0} duties.`
      )
    } catch (e) {
      toast.error(`Could not import backup: ${e.message}`)
    } finally {
      setPendingImportFile(null)
    }
  }

  async function handleClear() {
    await clearAllData()
    toast.success('All local data cleared.')
    setConfirmClear(false)
  }

  return (
    <Layout title="Backup & Restore" subtitle="Export a full JSON snapshot of your data, or restore from a previous backup">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
            <DownloadCloud size={18} />
          </div>
          <h3 className="font-display font-semibold text-ink-800 mb-1">Export All Data</h3>
          <p className="text-sm text-ink-500 mb-4">Download every teacher, classroom, exam, duty, and history record as one JSON file.</p>
          <Button onClick={handleExport} className="w-full">
            <DatabaseBackup size={15} /> Export Backup
          </Button>
        </Card>

        <Card>
          <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
            <UploadCloud size={18} />
          </div>
          <h3 className="font-display font-semibold text-ink-800 mb-1">Import Backup</h3>
          <p className="text-sm text-ink-500 mb-4">Restore from a Duty Desk backup file. This replaces all current data.</p>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFilePicked} className="hidden" />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">
            <UploadCloud size={15} /> Choose Backup File
          </Button>
        </Card>

        <Card>
          <div className="h-10 w-10 rounded-lg bg-coral-50 text-coral-500 flex items-center justify-center mb-3">
            <Trash2 size={18} />
          </div>
          <h3 className="font-display font-semibold text-ink-800 mb-1">Clear All Data</h3>
          <p className="text-sm text-ink-500 mb-4">Permanently erase everything stored locally in this browser. Cannot be undone.</p>
          <Button variant="danger" onClick={() => setConfirmClear(true)} className="w-full">
            <Trash2 size={15} /> Clear All Data
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingImportFile}
        title="Restore this backup?"
        message={`Importing "${pendingImportFile?.name}" will replace all current teachers, classrooms, exams, duties, and history with the contents of this file. Continue?`}
        confirmLabel="Import & Replace"
        onConfirm={confirmImport}
        onCancel={() => setPendingImportFile(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        message="This will permanently delete every teacher, classroom, exam, duty, and history record stored in this browser. This cannot be undone. Consider exporting a backup first."
        confirmLabel="Clear Everything"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </Layout>
  )
}
