import { db, logHistory } from './db.js'

export async function listExams() {
  return db.exams.toArray()
}

export async function listExamClassrooms() {
  return db.examClassrooms.toArray()
}

export async function getClassroomsForExam(examId) {
  const links = await db.examClassrooms.where('examId').equals(examId).toArray()
  return links.map((l) => l.classroomId)
}

export async function upsertExam(record, { isNew = false } = {}) {
  await db.exams.put(record)
  await logHistory({ examId: record.examId, action: isNew ? 'EXAM_CREATED' : 'EXAM_UPDATED', detail: `${record.subject} ${isNew ? 'added' : 'updated'}` })
}

export async function setExamClassrooms(examId, classroomIds) {
  await db.transaction('rw', db.examClassrooms, async () => {
    await db.examClassrooms.where('examId').equals(examId).delete()
    await db.examClassrooms.bulkAdd(classroomIds.map((classroomId) => ({ examId, classroomId })))
  })
}

export async function deleteExam(examId) {
  const dutyCount = await db.duties.where('examId').equals(examId).count()
  if (dutyCount > 0) {
    throw new Error('This exam has generated duties. Remove or regenerate its duties before deleting the exam.')
  }
  await db.transaction('rw', db.exams, db.examClassrooms, async () => {
    await db.exams.delete(examId)
    await db.examClassrooms.where('examId').equals(examId).delete()
  })
  await logHistory({ examId, action: 'EXAM_DELETED', detail: 'Exam removed' })
}

export async function bulkReplaceExams(examRecords, examClassroomLinks) {
  await db.transaction('rw', db.exams, db.examClassrooms, async () => {
    await db.exams.clear()
    await db.examClassrooms.clear()
    await db.exams.bulkPut(examRecords)
    if (examClassroomLinks.length) await db.examClassrooms.bulkAdd(examClassroomLinks)
  })
}

export async function bulkAppendExams(examRecords, examClassroomLinks) {
  await db.exams.bulkPut(examRecords)
  if (examClassroomLinks.length) await db.examClassrooms.bulkAdd(examClassroomLinks)
}
