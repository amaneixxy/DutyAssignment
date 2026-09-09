import Dexie from 'dexie'

// ---------------------------------------------------------------------------
// Duty Desk local database (IndexedDB via Dexie)
//
// Tables:
//   teachers            - teacher master records
//   classrooms          - classroom master records
//   exams               - exam schedule (an exam may span multiple classrooms
//                          via examClassrooms below, since one subject can be
//                          held in several rooms at the same date/shift)
//   examClassrooms      - join table: which classrooms host which exam
//   duties              - one row per teacher assignment (PRIMARY | BACKUP)
//   teacherAvailability - explicit available/unavailable overrides
//   absences            - recorded absences and the resulting reassignment
//   allocationHistory   - full audit trail of every automatic/manual change
//   settings            - key/value app configuration
// ---------------------------------------------------------------------------

export const db = new Dexie('examDutyDeskDB')

db.version(1).stores({
  teachers: 'teacherId, teacherName, department, status',
  classrooms: 'classroomId, classroomName, building, status',
  exams: 'examId, date, shift, subject',
  examClassrooms: '++id, examId, classroomId',
  duties: '++id, examId, classroomId, date, shift, teacherId, role, [date+shift+teacherId], [examId+classroomId]',
  teacherAvailability: '++id, teacherId, date, shift, [teacherId+date+shift]',
  absences: '++id, teacherId, date, shift, createdAt',
  allocationHistory: '++id, timestamp, examId, classroomId, teacherId, action',
  settings: 'key'
})

// Default settings applied on first run
export const DEFAULT_SETTINGS = {
  primaryTeachersPerClassroom: 2,
  backupTeachersPerClassroom: 0,
  enableShiftBackups: true,
  shiftBackupPercentage: 50,
  allocationPriority: 'total', // 'total' | 'primary'
  avoidRepeatedClassroom: true,
  avoidRepeatedPairing: true
}

export async function ensureDefaultSettings() {
  const existing = await db.settings.toArray()
  const map = Object.fromEntries(existing.map((s) => [s.key, s.value]))
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in map)) {
      await db.settings.put({ key, value })
    }
  }
}

export async function getSettings() {
  const rows = await db.settings.toArray()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...map }
}

export async function updateSetting(key, value) {
  await db.settings.put({ key, value })
}

export async function clearAllData() {
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
      await Promise.all([
        db.teachers.clear(),
        db.classrooms.clear(),
        db.exams.clear(),
        db.examClassrooms.clear(),
        db.duties.clear(),
        db.teacherAvailability.clear(),
        db.absences.clear(),
        db.allocationHistory.clear(),
        db.settings.clear()
      ])
    }
  )
  await ensureDefaultSettings()
}

export async function logHistory(entry) {
  await db.allocationHistory.add({
    timestamp: new Date().toISOString(),
    ...entry
  })
}
