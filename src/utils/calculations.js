export function computeDashboardStats({ teachers, classrooms, exams, duties }) {
  const activeTeachers = teachers.filter((t) => t.status === 'Active')
  const primaryDuties = duties.filter((d) => d.role === 'PRIMARY')
  const backupDuties = duties.filter((d) => d.role === 'BACKUP')

  return {
    totalTeachers: teachers.length,
    activeTeachers: activeTeachers.length,
    totalClassrooms: classrooms.length,
    upcomingExams: exams.length,
    assignedDuties: primaryDuties.length,
    backupDuties: backupDuties.length
  }
}

export function topAndBottomWorkload(dutyCountsMap, teachersById, count = 5) {
  const list = [...dutyCountsMap.values()]
    .map((r) => ({ ...r, name: teachersById.get(r.teacherId)?.teacherName || r.teacherId }))
    .sort((a, b) => b.total - a.total)
  return {
    most: list.slice(0, count),
    least: [...list].sort((a, b) => a.total - b.total).slice(0, count)
  }
}
