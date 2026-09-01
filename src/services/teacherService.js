import { db, logHistory } from './db.js'

export async function listTeachers() {
  return db.teachers.toArray()
}

export async function getTeacher(teacherId) {
  return db.teachers.get(teacherId)
}

export async function upsertTeacher(record, { isNew = false } = {}) {
  await db.teachers.put(record)
  await logHistory({
    teacherId: record.teacherId,
    action: isNew ? 'TEACHER_CREATED' : 'TEACHER_UPDATED',
    detail: `${record.teacherName} ${isNew ? 'added' : 'updated'}`
  })
}

export async function deleteOrDeactivateTeacher(teacherId) {
  const dutyCount = await db.duties.where('teacherId').equals(teacherId).count()
  if (dutyCount > 0) {
    await db.teachers.update(teacherId, { status: 'Inactive' })
    await logHistory({ teacherId, action: 'TEACHER_DEACTIVATED', detail: 'Has duty history; deactivated instead of deleted' })
    return { deactivated: true }
  }
  await db.teachers.delete(teacherId)
  await logHistory({ teacherId, action: 'TEACHER_DELETED', detail: 'Removed (no duty history)' })
  return { deleted: true }
}

export async function bulkReplaceTeachers(records) {
  await db.transaction('rw', db.teachers, async () => {
    await db.teachers.clear()
    await db.teachers.bulkPut(records)
  })
}

export async function bulkAppendTeachers(records) {
  await db.teachers.bulkPut(records)
}

export async function getTeacherDutyHistory(teacherId) {
  const duties = await db.duties.where('teacherId').equals(teacherId).toArray()
  return duties.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
