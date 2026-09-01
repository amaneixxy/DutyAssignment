import { db, ensureDefaultSettings } from './db.js'

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Neha', 'Rohit', 'Pooja', 'Vikram', 'Anjali', 'Suresh', 'Kavita',
  'Arjun', 'Meena', 'Sanjay', 'Divya', 'Manoj', 'Sunita', 'Karan', 'Ritu', 'Deepak', 'Shreya'
]
const LAST_NAMES = [
  'Sharma', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Rao', 'Nair', 'Iyer', 'Reddy', 'Mehta',
  'Joshi', 'Malhotra', 'Chopra', 'Bose', 'Kapoor', 'Agarwal', 'Pillai', 'Menon', 'Das', 'Patel'
]
const DEPARTMENTS = ['Mathematics', 'Science', 'English', 'Computer Science', 'History', 'Physics', 'Chemistry', 'Economics']
const SUBJECTS = ['CSE101', 'CSE102', 'CSE103', 'MAT201', 'PHY101', 'CHE101', 'ENG101', 'ECO201', 'BIO101', 'HIS101']
const BUILDINGS = ['Main Building', 'Science Block', 'Annex']

export async function loadDemoData() {
  await ensureDefaultSettings()

  const teachers = FIRST_NAMES.map((first, i) => ({
    teacherId: `T${String(i + 1).padStart(3, '0')}`,
    teacherName: `${first} ${LAST_NAMES[i]}`,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    email: `${first.toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@example.edu`,
    phone: `98765${String(40000 + i).padStart(5, '0')}`,
    status: i === 18 ? 'Inactive' : 'Active'
  }))

  const classrooms = Array.from({ length: 10 }).map((_, i) => ({
    classroomId: `C${String(i + 1).padStart(3, '0')}`,
    classroomName: `Room ${100 + i}`,
    building: BUILDINGS[i % BUILDINGS.length],
    floor: String((i % 3) + 1),
    capacity: 30 + (i % 4) * 10,
    status: 'Available'
  }))

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + 3)
  const dates = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + i)
    return d
  })

  const exams = []
  const examClassroomLinks = []
  let examCounter = 1

  dates.forEach((d, dayIdx) => {
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })

    ;['Morning', 'Afternoon'].forEach((shift, shiftIdx) => {
      const [startTime, endTime] = shift === 'Morning' ? ['09:00', '12:00'] : ['14:00', '17:00']
      // 1 exam per shift, held across 3 classrooms
      const examId = `E${String(examCounter).padStart(3, '0')}`
      examCounter++
      const subject = SUBJECTS[(dayIdx * 2 + shiftIdx) % SUBJECTS.length]
      exams.push({ examId, date: dateStr, day: dayName, shift, startTime, endTime, subject })

      const roomsForThisExam = classrooms.slice(0, 3).map((c, ci) => classrooms[(dayIdx + shiftIdx + ci) % classrooms.length])
      roomsForThisExam.forEach((room) => {
        examClassroomLinks.push({ examId, classroomId: room.classroomId })
      })
    })
  })

  await db.transaction('rw', db.teachers, db.classrooms, db.exams, db.examClassrooms, db.duties, async () => {
    await db.teachers.bulkPut(teachers)
    await db.classrooms.bulkPut(classrooms)
    await db.exams.bulkPut(exams)
    await db.examClassrooms.bulkAdd(examClassroomLinks)
  })

  return { teacherCount: teachers.length, classroomCount: classrooms.length, examCount: exams.length }
}
