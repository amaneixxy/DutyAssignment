import { db, clearAllData, ensureDefaultSettings } from './db.js'
import { downloadJson } from './csvService.js'

export async function exportAllData() {
  const [teachers, classrooms, exams, examClassrooms, duties, teacherAvailability, absences, allocationHistory, settings] =
    await Promise.all([
      db.teachers.toArray(),
      db.classrooms.toArray(),
      db.exams.toArray(),
      db.examClassrooms.toArray(),
      db.duties.toArray(),
      db.teacherAvailability.toArray(),
      db.absences.toArray(),
      db.allocationHistory.toArray(),
      db.settings.toArray()
    ])

  const payload = {
    meta: {
      app: 'Duty Desk',
      exportedAt: new Date().toISOString(),
      version: 1
    },
    teachers,
    classrooms,
    exams,
    examClassrooms,
    duties,
    teacherAvailability,
    absences,
    allocationHistory,
    settings
  }

  const filename = `exam-management-backup-${new Date().toISOString().slice(0, 10)}.json`
  downloadJson(filename, payload)
  return payload
}

export async function importBackup(fileText) {
  const payload = JSON.parse(fileText)
  if (!payload || !payload.meta || payload.meta.app !== 'Duty Desk') {
    throw new Error('This file does not look like a valid Duty Desk backup.')
  }

  await clearAllData()

  await db.transaction(
    'rw',
    db.teachers,
    db.classrooms,
    db.exams,
    db.examClassrooms,
    db.duties,
    db.teacherAvailability,
    db.absences,
    db.allocationHistory,
    db.settings,
    async () => {
      if (payload.teachers?.length) await db.teachers.bulkPut(payload.teachers)
      if (payload.classrooms?.length) await db.classrooms.bulkPut(payload.classrooms)
      if (payload.exams?.length) await db.exams.bulkPut(payload.exams)
      if (payload.examClassrooms?.length) await db.examClassrooms.bulkPut(payload.examClassrooms)
      if (payload.duties?.length) await db.duties.bulkPut(payload.duties)
      if (payload.teacherAvailability?.length) await db.teacherAvailability.bulkPut(payload.teacherAvailability)
      if (payload.absences?.length) await db.absences.bulkPut(payload.absences)
      if (payload.allocationHistory?.length) await db.allocationHistory.bulkPut(payload.allocationHistory)
      if (payload.settings?.length) await db.settings.bulkPut(payload.settings)
    }
  )

  await ensureDefaultSettings()
  return payload
}
