import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db.js'

export function useExams() {
  return useLiveQuery(() => db.exams.toArray(), [], []) || []
}

export function useExamClassrooms() {
  return useLiveQuery(() => db.examClassrooms.toArray(), [], []) || []
}
