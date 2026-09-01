import { db, logHistory } from './db.js'

export async function listClassrooms() {
  return db.classrooms.toArray()
}

export async function upsertClassroom(record, { isNew = false } = {}) {
  await db.classrooms.put(record)
  await logHistory({
    classroomId: record.classroomId,
    action: isNew ? 'CLASSROOM_CREATED' : 'CLASSROOM_UPDATED',
    detail: `${record.classroomName} ${isNew ? 'added' : 'updated'}`
  })
}

export async function deleteOrDeactivateClassroom(classroomId) {
  const dutyCount = await db.duties.where('classroomId').equals(classroomId).count()
  if (dutyCount > 0) {
    await db.classrooms.update(classroomId, { status: 'Unavailable' })
    await logHistory({ classroomId, action: 'CLASSROOM_DEACTIVATED', detail: 'Has duty history; marked unavailable instead of deleted' })
    return { deactivated: true }
  }
  await db.classrooms.delete(classroomId)
  await logHistory({ classroomId, action: 'CLASSROOM_DELETED', detail: 'Removed (no duty history)' })
  return { deleted: true }
}

export async function bulkReplaceClassrooms(records) {
  await db.transaction('rw', db.classrooms, async () => {
    await db.classrooms.clear()
    await db.classrooms.bulkPut(records)
  })
}

export async function bulkAppendClassrooms(records) {
  await db.classrooms.bulkPut(records)
}
