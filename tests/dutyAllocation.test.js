import { describe, it, expect } from 'vitest'
import { generateDutySchedule, reassignForAbsence, deriveTeacherDutyCounts } from '../src/algorithms/dutyAllocation.js'

const teachers = [
  { teacherId: 'T1', teacherName: 'Alice', status: 'Active' },
  { teacherId: 'T2', teacherName: 'Bob', status: 'Active' },
  { teacherId: 'T3', teacherName: 'Cara', status: 'Active' },
  { teacherId: 'T4', teacherName: 'Dan', status: 'Active' },
  { teacherId: 'T5', teacherName: 'Eve', status: 'Active' },
  { teacherId: 'T6', teacherName: 'Frank', status: 'Active' }
]

const classrooms = [
  { classroomId: 'C1', classroomName: 'Room 1', status: 'Available' },
  { classroomId: 'C2', classroomName: 'Room 2', status: 'Available' }
]

const exam = { examId: 'E1', date: '2026-09-01', day: 'Tuesday', shift: 'Morning', startTime: '09:00', endTime: '12:00', subject: 'CSE101' }
const examClassrooms = [
  { examId: 'E1', classroomId: 'C1' },
  { examId: 'E1', classroomId: 'C2' }
]

const settings = {
  primaryTeachersPerClassroom: 2,
  backupTeachersPerClassroom: 0,
  enableShiftBackups: true,
  shiftBackupPercentage: 50,
  avoidRepeatedClassroom: true,
  avoidRepeatedPairing: true
}

describe('generateDutySchedule', () => {
  it('Test 1: allocates 50% of shift primary teachers as shift backup pool when backupTeachersPerClassroom = 0', () => {
    // 2 rooms x 2 primary teachers = 4 primary teachers required in this shift.
    // 50% shift backup pool = 2 additional backup teachers for the shift.
    const result = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })

    const primaries = result.assignments.filter((a) => a.role === 'PRIMARY')
    const shiftBackups = result.assignments.filter((a) => a.classroomId === 'SHIFT_BACKUP' && a.role === 'BACKUP')

    expect(primaries.length).toBe(4)
    expect(shiftBackups.length).toBe(2)
  })

  it('Test 2: prioritizes teachers with lower duty count', () => {
    const singleRoomLinks = [{ examId: 'E1', classroomId: 'C1' }]
    const existingDuties = [
      { teacherId: 'T1', role: 'PRIMARY', classroomId: 'C1', examId: 'X', date: '2026-08-01', shift: 'Morning' },
      { teacherId: 'T1', role: 'PRIMARY', classroomId: 'C1', examId: 'X2', date: '2026-08-02', shift: 'Morning' }
    ]
    const result = generateDutySchedule({
      teachers,
      classrooms,
      exams: [exam],
      examClassrooms: singleRoomLinks,
      existingDuties,
      settings
    })
    const assignedIds = result.assignments.map((a) => a.teacherId)
    expect(assignedIds).not.toContain('T1')
  })

  it('Test 3: a teacher cannot receive two duties in the same slot', () => {
    const result = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    const seen = new Set()
    for (const a of result.assignments) {
      const key = `${a.date}|${a.shift}|${a.teacherId}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('Test 4: unavailable teachers cannot be assigned', () => {
    const availability = [{ teacherId: 'T1', date: '2026-09-01', shift: 'Morning', available: false }]
    const result = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, availability, existingDuties: [], settings })
    expect(result.assignments.some((a) => a.teacherId === 'T1')).toBe(false)
  })

  it('Test 5: backup teacher must be different from primaries in the same shift', () => {
    const result = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    const primaries = result.assignments.filter((a) => a.role === 'PRIMARY').map((a) => a.teacherId)
    const shiftBackups = result.assignments.filter((a) => a.classroomId === 'SHIFT_BACKUP').map((a) => a.teacherId)
    for (const b of shiftBackups) {
      expect(primaries).not.toContain(b)
    }
  })

  it('Test 6: duty counts are derived correctly', () => {
    const result = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    const counts = deriveTeacherDutyCounts(teachers, result.assignments)
    for (const rec of counts.values()) {
      expect(rec.total).toBe(rec.primary + rec.backup)
    }
  })

  it('Test 7: insufficient teachers generate warnings', () => {
    const fewTeachers = teachers.slice(0, 2)
    const result = generateDutySchedule({ teachers: fewTeachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.statistics.totalUnassigned).toBeGreaterThan(0)
  })

  it('Test 8: regeneration is deterministic', () => {
    const stripTimestamps = (arr) => arr.map(({ assignedAt, ...rest }) => rest)
    const result1 = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    const result2 = generateDutySchedule({ teachers, classrooms, exams: [exam], examClassrooms, existingDuties: [], settings })
    expect(stripTimestamps(result1.assignments)).toEqual(stripTimestamps(result2.assignments))
  })
})

describe('reassignForAbsence', () => {
  it('Test 9: absence correctly promotes selected backup teacher from pool to primary', () => {
    const duties = [
      { id: 1, examId: 'E1', classroomId: 'C1', date: '2026-09-01', shift: 'Morning', teacherId: 'T1', role: 'PRIMARY', subject: 'CSE101', day: 'Tuesday', startTime: '09:00', endTime: '12:00' },
      { id: 2, examId: 'E1', classroomId: 'C1', date: '2026-09-01', shift: 'Morning', teacherId: 'T2', role: 'PRIMARY', subject: 'CSE101', day: 'Tuesday', startTime: '09:00', endTime: '12:00' },
      { id: 3, examId: 'E1', classroomId: 'SHIFT_BACKUP', date: '2026-09-01', shift: 'Morning', teacherId: 'T5', role: 'BACKUP', subject: 'Shift Backup Pool', day: 'Tuesday', startTime: '09:00', endTime: '12:00' }
    ]
    const result = reassignForAbsence({ absentTeacherId: 'T1', replacementTeacherId: 'T5', date: '2026-09-01', shift: 'Morning', duties, teachers })

    const primaries = result.updatedDuties.filter((d) => d.role === 'PRIMARY').map((d) => d.teacherId)
    expect(primaries).toContain('T5')
    expect(primaries).not.toContain('T1')

    // T5 should be removed from the shift backup pool so they cannot be reused
    const backups = result.updatedDuties.filter((d) => d.role === 'BACKUP').map((d) => d.teacherId)
    expect(backups).not.toContain('T5')
  })
})
