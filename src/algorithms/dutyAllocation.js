// ---------------------------------------------------------------------------
// Duty allocation algorithm
//
// This module is intentionally framework-free: it accepts plain data and
// returns plain data so it can be unit tested and reused outside React.
//
// generateDutySchedule({ teachers, classrooms, exams, examClassrooms,
//                         availability, absences, existingDuties, settings })
//
// -> { assignments, warnings, errors, statistics }
//
// ALGORITHM (see pseudocode in the project brief, section 39):
//
// For every exam slot (an exam+date+shift), for every classroom hosting it:
//   1. Build the candidate pool: Active teachers who are not explicitly
//      unavailable, not absent, and not already assigned anywhere in this
//      exact date+shift (hard constraints -> exclusion, never a penalty).
//   2. Score every remaining candidate (lower score = better):
//        score = totalDuties * HIGH_WEIGHT
//               + sameClassroomPenalty   (soft, if avoidRepeatedClassroom)
//               + repeatedPairPenalty    (soft, if avoidRepeatedPairing)
//               + primaryBackupBalancePenalty
//      Ties are broken deterministically by teacherId so repeated runs on
//      identical input produce identical output.
//   3. Pick the two lowest-scoring candidates as PRIMARY 1 and PRIMARY 2,
//      recomputing scores after each pick (their slot is now taken and the
//      "current duty count" moves for the *next* classroom, not this one).
//   4. Pick one more as BACKUP, excluding the two primaries.
//   5. Record shortages as warnings/errors rather than ever assigning fewer
//      than required teachers.
// ---------------------------------------------------------------------------

const HIGH_WEIGHT = 100
const SAME_CLASSROOM_PENALTY = 15
const REPEATED_PAIR_PENALTY = 10
const BACKUP_ALREADY_ELSEWHERE_PENALTY = 5

/**
 * @returns {{assignments: object[], warnings: object[], errors: object[], statistics: object}}
 */
export function generateDutySchedule({
  teachers = [],
  classrooms = [],
  exams = [],
  examClassrooms = [],
  availability = [],
  absences = [],
  existingDuties = [],
  settings = {}
}) {
  const primaryPerRoom = settings.primaryTeachersPerClassroom ?? 2
  const backupPerRoom = settings.backupTeachersPerClassroom ?? 0
  const enableShiftBackups = settings.enableShiftBackups ?? true
  const shiftBackupPct = settings.shiftBackupPercentage ?? 50
  const avoidRepeatedClassroom = settings.avoidRepeatedClassroom ?? true
  const avoidRepeatedPairing = settings.avoidRepeatedPairing ?? true

  const warnings = []
  const errors = []
  const assignments = []

  const activeTeachers = teachers.filter((t) => t.status === 'Active')
  const classroomById = new Map(classrooms.map((c) => [c.classroomId, c]))

  if (activeTeachers.length === 0) {
    errors.push({ message: 'No active teachers available. Please import or activate teachers before generating duties.' })
  }
  if (classrooms.length === 0) {
    errors.push({ message: 'No classrooms available. Please import classrooms before generating duties.' })
  }
  if (exams.length === 0) {
    errors.push({ message: 'No exams scheduled. Please import or add an exam schedule before generating duties.' })
  }
  if (errors.length > 0) {
    return { assignments, warnings, errors, statistics: emptyStats() }
  }

  // ---- Running state, seeded from existing duties (for incremental runs) --
  const totalDuties = new Map() // teacherId -> count
  const primaryDuties = new Map()
  const backupDuties = new Map()
  const classroomHistory = new Map() // teacherId -> Set(classroomId)
  const pairHistory = new Map() // "idA|idB" sorted -> count
  const slotAssignment = new Map() // "date|shift" -> Set(teacherId) already used in that slot

  for (const t of activeTeachers) {
    totalDuties.set(t.teacherId, 0)
    primaryDuties.set(t.teacherId, 0)
    backupDuties.set(t.teacherId, 0)
    classroomHistory.set(t.teacherId, new Set())
  }

  for (const d of existingDuties) {
    bumpDuty(d.teacherId, d.role)
    if (classroomHistory.has(d.teacherId)) {
      classroomHistory.get(d.teacherId).add(d.classroomId)
    }
    const slotKey = `${d.date}|${d.shift}`
    if (!slotAssignment.has(slotKey)) slotAssignment.set(slotKey, new Set())
    slotAssignment.get(slotKey).add(d.teacherId)
  }
  // Seed pair history from existing PRIMARY pairs in the same exam+classroom
  const existingPrimaryByRoom = new Map()
  for (const d of existingDuties) {
    if (d.role !== 'PRIMARY') continue
    const key = `${d.examId}|${d.classroomId}`
    if (!existingPrimaryByRoom.has(key)) existingPrimaryByRoom.set(key, [])
    existingPrimaryByRoom.get(key).push(d.teacherId)
  }
  for (const ids of existingPrimaryByRoom.values()) {
    if (ids.length === 2) bumpPair(ids[0], ids[1])
  }

  function bumpDuty(teacherId, role) {
    totalDuties.set(teacherId, (totalDuties.get(teacherId) || 0) + 1)
    if (role === 'PRIMARY') primaryDuties.set(teacherId, (primaryDuties.get(teacherId) || 0) + 1)
    else backupDuties.set(teacherId, (backupDuties.get(teacherId) || 0) + 1)
  }
  function pairKey(a, b) {
    return [a, b].sort().join('|')
  }
  function bumpPair(a, b) {
    const k = pairKey(a, b)
    pairHistory.set(k, (pairHistory.get(k) || 0) + 1)
  }

  // Build unavailable set: explicit availability=false, or absence records
  const unavailableSet = new Set(
    availability.filter((a) => a.available === false).map((a) => `${a.teacherId}|${a.date}|${a.shift}`)
  )
  const absentSet = new Set(absences.map((a) => `${a.teacherId}|${a.date}|${a.shift}`))

  function isUnavailable(teacherId, date, shift) {
    const key = `${teacherId}|${date}|${shift}`
    return unavailableSet.has(key) || absentSet.has(key)
  }

  // Build list of (exam, classroom) work items, in a deterministic order
  const examClassroomList = []
  for (const exam of exams) {
    const roomLinks = examClassrooms.filter((ec) => ec.examId === exam.examId)
    for (const link of roomLinks) {
      examClassroomList.push({ exam, classroomId: link.classroomId })
    }
  }
  examClassroomList.sort((a, b) => {
    if (a.exam.date !== b.exam.date) return a.exam.date < b.exam.date ? -1 : 1
    if (a.exam.shift !== b.exam.shift) return a.exam.shift < b.exam.shift ? -1 : 1
    return a.classroomId < b.classroomId ? -1 : 1
  })

  let totalRequiredPrimary = 0
  let totalRequiredBackup = 0
  let totalAssignedPrimary = 0
  let totalAssignedBackup = 0
  let totalUnassigned = 0

  const primariesPerShift = new Map() // "date|shift" -> { count: number, sampleExam: exam }

  for (const item of examClassroomList) {
    const { exam, classroomId } = item
    const classroom = classroomById.get(classroomId)
    if (!classroom || classroom.status !== 'Available') {
      warnings.push({
        examId: exam.examId,
        classroomId,
        message: `Classroom ${classroomId} is not available or not found; skipped.`
      })
      continue
    }

    const slotKey = `${exam.date}|${exam.shift}`
    if (!slotAssignment.has(slotKey)) slotAssignment.set(slotKey, new Set())
    const usedInSlot = slotAssignment.get(slotKey)

    if (!primariesPerShift.has(slotKey)) {
      primariesPerShift.set(slotKey, { count: 0, sampleExam: exam })
    }

    totalRequiredPrimary += primaryPerRoom

    const chosenPrimaries = []

    for (let i = 0; i < primaryPerRoom; i++) {
      const candidate = pickBestCandidate({
        activeTeachers,
        excludeIds: new Set([...usedInSlot, ...chosenPrimaries]),
        isUnavailable,
        exam,
        classroomId,
        totalDuties,
        primaryDuties,
        backupDuties,
        classroomHistory,
        pairHistory,
        pairKey,
        chosenSoFarInRoom: chosenPrimaries,
        avoidRepeatedClassroom,
        avoidRepeatedPairing
      })
      if (!candidate) break
      chosenPrimaries.push(candidate)
      usedInSlot.add(candidate)
      bumpDuty(candidate, 'PRIMARY')
      classroomHistory.get(candidate)?.add(classroomId)
      totalAssignedPrimary++
      primariesPerShift.get(slotKey).count++
    }

    if (chosenPrimaries.length === 2) {
      bumpPair(chosenPrimaries[0], chosenPrimaries[1])
    }

    if (chosenPrimaries.length < primaryPerRoom) {
      const shortage = primaryPerRoom - chosenPrimaries.length
      totalUnassigned += shortage
      warnings.push({
        examId: exam.examId,
        classroomId,
        message: `Room ${classroomId} (${exam.subject}, ${exam.date} ${exam.shift}) is short ${shortage} primary teacher(s). Only ${chosenPrimaries.length}/${primaryPerRoom} assigned.`
      })
    }

    for (const teacherId of chosenPrimaries) {
      assignments.push(buildAssignment(exam, classroomId, teacherId, 'PRIMARY'))
    }

    // Per-classroom backups (only if explicitly set > 0)
    if (backupPerRoom > 0) {
      totalRequiredBackup += backupPerRoom
      const chosenBackups = []
      for (let i = 0; i < backupPerRoom; i++) {
        const candidate = pickBestCandidate({
          activeTeachers,
          excludeIds: new Set([...usedInSlot, ...chosenPrimaries, ...chosenBackups]),
          isUnavailable,
          exam,
          classroomId,
          totalDuties,
          primaryDuties,
          backupDuties,
          classroomHistory,
          pairHistory,
          pairKey,
          chosenSoFarInRoom: chosenPrimaries,
          avoidRepeatedClassroom,
          avoidRepeatedPairing
        })
        if (!candidate) break
        chosenBackups.push(candidate)
        usedInSlot.add(candidate)
        bumpDuty(candidate, 'BACKUP')
        classroomHistory.get(candidate)?.add(classroomId)
        totalAssignedBackup++
      }

      if (chosenBackups.length < backupPerRoom) {
        const shortage = backupPerRoom - chosenBackups.length
        totalUnassigned += shortage
        warnings.push({
          examId: exam.examId,
          classroomId,
          message: `Room ${classroomId} (${exam.subject}, ${exam.date} ${exam.shift}) could not receive a backup teacher. Only ${chosenBackups.length}/${backupPerRoom} assigned.`
        })
      }

      for (const teacherId of chosenBackups) {
        assignments.push(buildAssignment(exam, classroomId, teacherId, 'BACKUP'))
      }
    }
  }

  // ---- Shift Backup Pool Allocation (50% of shift primary count) -----
  if (enableShiftBackups && shiftBackupPct > 0) {
    for (const [slotKey, info] of primariesPerShift.entries()) {
      const [date, shift] = slotKey.split('|')
      const requiredShiftBackups = Math.ceil(info.count * (shiftBackupPct / 100))
      totalRequiredBackup += requiredShiftBackups

      const usedInSlot = slotAssignment.get(slotKey) || new Set()
      const chosenShiftBackups = []

      for (let i = 0; i < requiredShiftBackups; i++) {
        const candidate = pickBestCandidate({
          activeTeachers,
          excludeIds: new Set([...usedInSlot, ...chosenShiftBackups]),
          isUnavailable,
          exam: info.sampleExam,
          classroomId: 'SHIFT_BACKUP',
          totalDuties,
          primaryDuties,
          backupDuties,
          classroomHistory,
          pairHistory,
          pairKey,
          chosenSoFarInRoom: [],
          avoidRepeatedClassroom: false,
          avoidRepeatedPairing: false
        })
        if (!candidate) break
        chosenShiftBackups.push(candidate)
        usedInSlot.add(candidate)
        bumpDuty(candidate, 'BACKUP')
        totalAssignedBackup++
      }

      if (chosenShiftBackups.length < requiredShiftBackups) {
        const shortage = requiredShiftBackups - chosenShiftBackups.length
        totalUnassigned += shortage
        warnings.push({
          examId: info.sampleExam.examId,
          classroomId: 'SHIFT_BACKUP',
          message: `Shift ${date} (${shift}) backup pool is short ${shortage} teacher(s). ${chosenShiftBackups.length}/${requiredShiftBackups} assigned.`
        })
      }

      for (const teacherId of chosenShiftBackups) {
        assignments.push({
          examId: info.sampleExam.examId,
          date,
          day: info.sampleExam.day,
          shift,
          startTime: info.sampleExam.startTime,
          endTime: info.sampleExam.endTime,
          classroomId: 'SHIFT_BACKUP',
          subject: 'Shift Backup Pool',
          teacherId,
          role: 'BACKUP',
          assignedAt: new Date().toISOString(),
          assignmentType: 'AUTO'
        })
      }
    }
  }

  const statistics = {
    totalRequired: totalRequiredPrimary + totalRequiredBackup,
    totalRequiredPrimary,
    totalRequiredBackup,
    totalAssigned: totalAssignedPrimary + totalAssignedBackup,
    totalAssignedPrimary,
    totalAssignedBackup,
    totalUnassigned,
    availableTeachers: activeTeachers.length,
    classroomsProcessed: examClassroomList.length
  }

  return { assignments, warnings, errors, statistics }
}

function buildAssignment(exam, classroomId, teacherId, role) {
  return {
    examId: exam.examId,
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
    assignmentType: 'AUTO'
  }
}

function pickBestCandidate({
  activeTeachers,
  excludeIds,
  isUnavailable,
  exam,
  classroomId,
  totalDuties,
  primaryDuties,
  backupDuties,
  classroomHistory,
  pairHistory,
  pairKey,
  chosenSoFarInRoom,
  avoidRepeatedClassroom,
  avoidRepeatedPairing
}) {
  let best = null
  let bestScore = Infinity

  for (const teacher of activeTeachers) {
    const id = teacher.teacherId
    if (excludeIds.has(id)) continue
    if (isUnavailable(id, exam.date, exam.shift)) continue

    let score = (totalDuties.get(id) || 0) * HIGH_WEIGHT

    // Soft: primary/backup balance -- prefer teachers who have relatively
    // fewer primary duties than backup (or vice versa is not penalized hard)
    const p = primaryDuties.get(id) || 0
    const b = backupDuties.get(id) || 0
    score += Math.abs(p - b) * 1

    if (avoidRepeatedClassroom && classroomHistory.get(id)?.has(classroomId)) {
      score += SAME_CLASSROOM_PENALTY
    }

    if (avoidRepeatedPairing) {
      for (const other of chosenSoFarInRoom) {
        const count = pairHistory.get(pairKey(id, other)) || 0
        score += count * REPEATED_PAIR_PENALTY
      }
    }

    // Deterministic tie-breaker
    if (score < bestScore || (score === bestScore && (!best || id < best))) {
      bestScore = score
      best = id
    }
  }

  return best
}

function emptyStats() {
  return {
    totalRequired: 0,
    totalRequiredPrimary: 0,
    totalRequiredBackup: 0,
    totalAssigned: 0,
    totalAssignedPrimary: 0,
    totalAssignedBackup: 0,
    totalUnassigned: 0,
    availableTeachers: 0,
    classroomsProcessed: 0
  }
}

/**
 * Handle a teacher absence: promote the backup to primary and find a new
 * backup for that classroom/slot. Pure function operating on plain data.
 *
 * @returns {{ updatedDuties: object[], historyEntries: object[], errors: object[] }}
 */
export function reassignForAbsence({
  absentTeacherId,
  replacementTeacherId = null,
  date,
  shift,
  duties, // all duties for this date+shift (across all rooms), including the room in question
  teachers,
  availability = [],
  absences = []
}) {
  const errors = []
  const historyEntries = []
  const updatedDuties = duties.map((d) => ({ ...d }))

  const affected = updatedDuties.filter(
    (d) => d.teacherId === absentTeacherId && d.date === date && d.shift === shift
  )

  if (affected.length === 0) {
    errors.push({ message: 'No duties found for this teacher on the given date/shift.' })
    return { updatedDuties, historyEntries, errors }
  }

  const activeTeachers = teachers.filter((t) => t.status === 'Active')
  const unavailableSet = new Set(
    availability.filter((a) => a.available === false).map((a) => `${a.teacherId}|${a.date}|${a.shift}`)
  )
  const absentSet = new Set(absences.map((a) => `${a.teacherId}|${a.date}|${a.shift}`))
  absentSet.add(`${absentTeacherId}|${date}|${shift}`)

  const usedInSlot = new Set(
    updatedDuties.filter((d) => d.date === date && d.shift === shift).map((d) => d.teacherId)
  )

  for (const duty of affected) {
    if (duty.role === 'PRIMARY') {
      let chosenReplacement = replacementTeacherId

      // If no explicit replacement specified, pick from the shift backup pool or available candidate
      if (!chosenReplacement) {
        const poolBackup = updatedDuties.find(
          (d) => d.date === date && d.shift === shift && d.role === 'BACKUP' && d.classroomId === 'SHIFT_BACKUP'
        )
        if (poolBackup) {
          chosenReplacement = poolBackup.teacherId
        } else {
          // Fallback to any per-room backup
          const roomBackup = updatedDuties.find(
            (d) => d.date === date && d.shift === shift && d.role === 'BACKUP'
          )
          if (roomBackup) chosenReplacement = roomBackup.teacherId
        }
      }

      if (chosenReplacement) {
        // Replace absent teacher's primary duty with chosen replacement teacher
        duty.teacherId = chosenReplacement
        duty.assignmentType = 'MANUAL'
        duty.assignedAt = new Date().toISOString()

        // Remove the replacement teacher from the backup pool for this slot so they cannot be reused
        const backupIdx = updatedDuties.findIndex(
          (d) => d.teacherId === chosenReplacement && d.date === date && d.shift === shift && d.role === 'BACKUP'
        )
        if (backupIdx !== -1) {
          updatedDuties.splice(backupIdx, 1)
        }

        historyEntries.push({
          examId: duty.examId,
          classroomId: duty.classroomId,
          teacherId: chosenReplacement,
          action: 'REPLACE_PRIMARY_TEACHER',
          detail: `${chosenReplacement} assigned to primary duty in room ${duty.classroomId}, replacing absent ${absentTeacherId} (removed from shift backup pool)`
        })
      } else {
        // No backup available: remove the duty and log error
        const idx = updatedDuties.indexOf(duty)
        if (idx !== -1) updatedDuties.splice(idx, 1)
        errors.push({
          message: `No available replacement backup teacher found for room ${duty.classroomId} on ${date} ${shift}.`
        })
      }
    } else {
      // Absent teacher was in the backup pool: remove them from the backup pool
      const idx = updatedDuties.indexOf(duty)
      if (idx !== -1) updatedDuties.splice(idx, 1)
      historyEntries.push({
        examId: duty.examId,
        classroomId: duty.classroomId,
        teacherId: absentTeacherId,
        action: 'REMOVE_ABSENT_BACKUP',
        detail: `Absent teacher ${absentTeacherId} removed from backup pool on ${date} ${shift}`
      })
    }
  }

  return { updatedDuties, historyEntries, errors }
}

/**
 * Derive duty counts for every teacher purely from duty records (section 34:
 * counts should never be manually incremented forever -- always derivable).
 */
export function deriveTeacherDutyCounts(teachers, duties) {
  const map = new Map()
  for (const t of teachers) {
    map.set(t.teacherId, { teacherId: t.teacherId, primary: 0, backup: 0, total: 0 })
  }
  for (const d of duties) {
    if (!map.has(d.teacherId)) {
      map.set(d.teacherId, { teacherId: d.teacherId, primary: 0, backup: 0, total: 0 })
    }
    const rec = map.get(d.teacherId)
    if (d.role === 'PRIMARY') rec.primary++
    else rec.backup++
    rec.total++
  }
  return map
}
