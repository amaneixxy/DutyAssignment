import { db, logHistory, getSettings } from './db.js'
import { generateDutySchedule, reassignForAbsence, deriveTeacherDutyCounts } from '../algorithms/dutyAllocation.js'

export async function listDuties() {
  return db.duties.toArray()
}

export async function getTeacherDutyCounts() {
  const [teachers, duties] = await Promise.all([db.teachers.toArray(), db.duties.toArray()])
  return deriveTeacherDutyCounts(teachers, duties)
}

/**
 * Run the allocation algorithm against current DB state, WITHOUT saving.
 * Used to build the preview shown before committing a schedule.
 */
export async function previewDutySchedule({ examIds = null } = {}) {
  const [teachers, classrooms, allExams, examClassrooms, availability, absences, existingDuties, settings] =
    await Promise.all([
      db.teachers.toArray(),
      db.classrooms.toArray(),
      db.exams.toArray(),
      db.examClassrooms.toArray(),
      db.teacherAvailability.toArray(),
      db.absences.toArray(),
      db.duties.toArray(),
      getSettings()
    ])

  const exams = examIds ? allExams.filter((e) => examIds.includes(e.examId)) : allExams

  const result = generateDutySchedule({
    teachers,
    classrooms,
    exams,
    examClassrooms,
    availability: availability.map((a) => ({ ...a, available: a.status === 'Available' })),
    absences,
    existingDuties: examIds ? existingDuties.filter((d) => !examIds.includes(d.examId)) : [],
    settings
  })

  return result
}

/**
 * Persist a previously generated (previewed) set of assignments.
 * Removes any prior duties for the affected exams first (regeneration-safe).
 */
export async function saveDutySchedule(assignments) {
  const examIds = [...new Set(assignments.map((a) => a.examId))]
  await db.transaction('rw', db.duties, db.allocationHistory, async () => {
    for (const examId of examIds) {
      await db.duties.where('examId').equals(examId).delete()
    }
    await db.duties.bulkAdd(assignments)
  })

  for (const a of assignments) {
    await logHistory({
      examId: a.examId,
      classroomId: a.classroomId,
      teacherId: a.teacherId,
      action: 'AUTO_ASSIGNED',
      detail: `${a.teacherId} auto-assigned as ${a.role} for ${a.classroomId} on ${a.date} ${a.shift}`
    })
  }

  return { savedCount: assignments.length }
}

/**
 * Regenerate duties, scoped to all / a specific date / a specific shift.
 */
export async function regenerateDuties({ scope = 'ALL', date = null, shift = null } = {}) {
  const allExams = await db.exams.toArray()
  let targetExams = allExams
  if (scope === 'DATE' && date) targetExams = allExams.filter((e) => e.date === date)
  if (scope === 'SHIFT' && shift) targetExams = allExams.filter((e) => e.shift === shift)

  const examIds = targetExams.map((e) => e.examId)
  const result = await previewDutySchedule({ examIds })
  return { ...result, examIds }
}

export async function manualAssign({ examId, classroomId, role, teacherId, previousTeacherId, reason }) {
  // Conflict validation: same teacher can't be double-booked in the same slot
  const exam = await db.exams.get(examId)
  if (!exam) throw new Error('Exam not found')

  const sameSlotDuties = await db.duties.where('[date+shift+teacherId]').equals([exam.date, exam.shift, teacherId]).toArray()
  const conflict = sameSlotDuties.find((d) => !(d.examId === examId && d.classroomId === classroomId))
  if (conflict) {
    throw new Error(`${teacherId} is already assigned to classroom ${conflict.classroomId} during this same slot.`)
  }

  const existing = await db.duties.where('[examId+classroomId]').equals([examId, classroomId]).toArray()
  const target = existing.find((d) => d.role === role)

  const newRecord = {
    examId,
    date: exam.date,
    day: exam.day,
    shift: exam.shift,
    startTime: exam.startTime,
    endTime: exam.endTime,
    classroomId,
    subject: exam.subject,
    teacherId,
    role,
    assignedAt: new Date().toISOString(),
    assignmentType: 'MANUAL'
  }

  if (target) {
    await db.duties.update(target.id, newRecord)
  } else {
    await db.duties.add(newRecord)
  }

  await logHistory({
    examId,
    classroomId,
    teacherId,
    action: 'MANUAL_REASSIGN',
    detail: previousTeacherId
      ? `${previousTeacherId} -> ${teacherId} (${role}). Reason: ${reason || 'Not specified'}`
      : `${teacherId} manually assigned as ${role}. Reason: ${reason || 'Not specified'}`
  })

  return newRecord
}

export async function recordAbsence({ teacherId, replacementTeacherId = null, date, shift, reason }) {
  const [duties, teachers, availability, absences] = await Promise.all([
    db.duties.where({ date, shift }).toArray(),
    db.teachers.toArray(),
    db.teacherAvailability.toArray(),
    db.absences.toArray()
  ])

  const { updatedDuties, historyEntries, errors } = reassignForAbsence({
    absentTeacherId: teacherId,
    replacementTeacherId,
    date,
    shift,
    duties,
    teachers,
    availability: availability.map((a) => ({ ...a, available: a.status === 'Available' })),
    absences
  })

  const actualReplacementId =
    replacementTeacherId ||
    historyEntries.find((h) => h.action === 'REPLACE_PRIMARY_TEACHER' || h.action === 'PROMOTE_BACKUP_TO_PRIMARY')?.teacherId ||
    null

  await db.transaction('rw', db.duties, db.absences, db.allocationHistory, async () => {
    await db.absences.add({
      teacherId,
      replacementTeacherId: actualReplacementId,
      date,
      shift,
      reason,
      createdAt: new Date().toISOString()
    })
    await db.duties.where({ date, shift }).delete()
    if (updatedDuties.length) await db.duties.bulkAdd(updatedDuties)
    for (const h of historyEntries) {
      await logHistory(h)
    }
    await logHistory({
      teacherId,
      action: 'ABSENCE_RECORDED',
      detail: `${teacherId} marked absent on ${date} ${shift}. Replaced by: ${actualReplacementId || 'None'}. Reason: ${reason || 'Not specified'}`
    })
  })

  return { updatedDuties, historyEntries, errors }
}

export async function getAllocationHistory({ limit = 200 } = {}) {
  const rows = await db.allocationHistory.orderBy('timestamp').reverse().limit(limit).toArray()
  return rows
}

export async function deleteDuty(dutyId, { reason = '' } = {}) {
  const duty = await db.duties.get(Number(dutyId))
  if (!duty) return
  await db.duties.delete(Number(dutyId))
  await logHistory({
    examId: duty.examId,
    classroomId: duty.classroomId,
    teacherId: duty.teacherId,
    action: 'DUTY_REMOVED',
    detail: `Duty for ${duty.teacherId} (${duty.role} - ${duty.subject || duty.examId} in ${duty.classroomId}) removed. Reason: ${reason || 'Manual removal'}`
  })
}

export async function updateDutyRole(dutyId, newRole, { reason = '' } = {}) {
  const duty = await db.duties.get(Number(dutyId))
  if (!duty) throw new Error('Duty not found')
  const oldRole = duty.role
  await db.duties.update(Number(dutyId), {
    role: newRole,
    assignmentType: 'MANUAL',
    assignedAt: new Date().toISOString()
  })
  await logHistory({
    examId: duty.examId,
    classroomId: duty.classroomId,
    teacherId: duty.teacherId,
    action: 'DUTY_ROLE_UPDATED',
    detail: `Role for ${duty.teacherId} changed from ${oldRole} to ${newRole} for ${duty.classroomId} on ${duty.date} ${duty.shift}. Reason: ${reason || 'Manual role update'}`
  })
}

export async function reassignDuty(dutyId, newTeacherId, { reason = '' } = {}) {
  const duty = await db.duties.get(Number(dutyId))
  if (!duty) throw new Error('Duty not found')
  if (duty.teacherId === newTeacherId) return

  // Validate double-booking for the target teacher in same date & shift
  const conflict = await db.duties
    .where('[date+shift+teacherId]')
    .equals([duty.date, duty.shift, newTeacherId])
    .first()

  if (conflict && conflict.id !== duty.id) {
    throw new Error(`Teacher ${newTeacherId} is already assigned to ${conflict.classroomId} during ${duty.date} (${duty.shift}).`)
  }

  const prevTeacher = duty.teacherId
  await db.duties.update(Number(dutyId), {
    teacherId: newTeacherId,
    assignmentType: 'MANUAL',
    assignedAt: new Date().toISOString()
  })
  await logHistory({
    examId: duty.examId,
    classroomId: duty.classroomId,
    teacherId: newTeacherId,
    action: 'MANUAL_REASSIGN',
    detail: `${prevTeacher} -> ${newTeacherId} (${duty.role}) in ${duty.classroomId} on ${duty.date} ${duty.shift}. Reason: ${reason || 'Manual reassignment'}`
  })
}

export async function assignDutyToTeacher({ teacherId, examId, classroomId, role = 'PRIMARY', reason = '' }) {
  const exam = await db.exams.get(examId)
  if (!exam) throw new Error('Exam not found')

  // Check collision in same date & shift
  const conflict = await db.duties
    .where('[date+shift+teacherId]')
    .equals([exam.date, exam.shift, teacherId])
    .first()

  if (conflict) {
    throw new Error(`Teacher is already assigned to ${conflict.classroomId} during ${exam.date} (${exam.shift}).`)
  }

  const newRecord = {
    examId,
    date: exam.date,
    day: exam.day,
    shift: exam.shift,
    startTime: exam.startTime,
    endTime: exam.endTime,
    classroomId,
    subject: classroomId === 'SHIFT_BACKUP' ? 'Shift Backup Pool' : exam.subject,
    teacherId,
    role,
    assignedAt: new Date().toISOString(),
    assignmentType: 'MANUAL'
  }

  const id = await db.duties.add(newRecord)
  await logHistory({
    examId,
    classroomId,
    teacherId,
    action: 'MANUAL_ASSIGN',
    detail: `${teacherId} manually assigned as ${role} for ${classroomId} on ${exam.date} ${exam.shift}. Reason: ${reason || 'Manual duty addition'}`
  })
  return { ...newRecord, id }
}

