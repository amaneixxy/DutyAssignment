import React, { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import Card from '../components/common/Card.jsx'
import Button from '../components/common/Button.jsx'
import { Field, Input, Select } from '../components/common/Field.jsx'
import { getSettings, updateSetting, DEFAULT_SETTINGS } from '../services/db.js'
import { useToast } from '../components/common/Toast.jsx'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key, value)
    }
    toast.success('Settings saved.')
  }

  if (!loaded) return null

  return (
    <Layout title="Settings" subtitle="Configure allocation defaults used by the duty generation algorithm">
      <Card className="max-w-xl">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary teachers per classroom">
              <Input
                type="number"
                min={1}
                value={settings.primaryTeachersPerClassroom}
                onChange={(e) => setSettings((s) => ({ ...s, primaryTeachersPerClassroom: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Backup teachers required">
              <Input
                type="number"
                min={0}
                value={settings.backupTeachersPerClassroom}
                onChange={(e) => setSettings((s) => ({ ...s, backupTeachersPerClassroom: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <Field label="Allocation priority">
            <Select value={settings.allocationPriority} onChange={(e) => setSettings((s) => ({ ...s, allocationPriority: e.target.value }))}>
              <option value="total">Total Duties</option>
              <option value="primary">Primary Duties</option>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-700 mb-3">
            <input
              type="checkbox"
              checked={settings.avoidRepeatedClassroom}
              onChange={(e) => setSettings((s) => ({ ...s, avoidRepeatedClassroom: e.target.checked }))}
            />
            Avoid repeated classroom assignments (soft constraint)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700 mb-4">
            <input
              type="checkbox"
              checked={settings.avoidRepeatedPairing}
              onChange={(e) => setSettings((s) => ({ ...s, avoidRepeatedPairing: e.target.checked }))}
            />
            Avoid repeated teacher pairing (soft constraint)
          </label>

          <Button type="submit">
            <Save size={15} /> Save Settings
          </Button>
        </form>
      </Card>
    </Layout>
  )
}
