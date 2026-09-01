import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db.js'

export function useTeachers() {
  return useLiveQuery(() => db.teachers.toArray(), [], []) || []
}
