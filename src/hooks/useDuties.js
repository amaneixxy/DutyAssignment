import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db.js'

export function useDuties() {
  return useLiveQuery(() => db.duties.toArray(), [], []) || []
}

export function useClassrooms() {
  return useLiveQuery(() => db.classrooms.toArray(), [], []) || []
}

export function useAllocationHistory() {
  return useLiveQuery(() => db.allocationHistory.orderBy('timestamp').reverse().toArray(), [], []) || []
}
