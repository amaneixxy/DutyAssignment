import Papa from 'papaparse'

const TEACHER_COLUMNS = ['teacher_id', 'teacher_name', 'department', 'email', 'phone', 'status']
const CLASSROOM_COLUMNS = ['classroom_id', 'classroom_name', 'building', 'floor', 'capacity', 'status']
const EXAM_COLUMNS_BASE = ['exam_id', 'date', 'day', 'shift', 'start_time', 'end_time', 'subject']

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => resolve(results),
      error: (err) => reject(err)
    })
  })
}

function isValidDate(str) {
  if (!str) return false
  const d = new Date(str)
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(str.trim())
}

function isValidTime(str) {
  return typeof str === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(str.trim())
}

/**
 * Validate parsed rows against a required column set + business rules.
 * Returns { validRows, invalidRows, missingColumns }
 * invalidRows: [{ row, index, errors: string[] }]
 */
export function validateTeachers(rows) {
  return validateGeneric(rows, TEACHER_COLUMNS, 'teacher_id', (row, errors) => {
    if (row.status && !['Active', 'Inactive'].includes(row.status.trim())) {
      errors.push(`status must be Active or Inactive (got "${row.status}")`)
    }
    if (row.email && !/^\S+@\S+\.\S+$/.test(row.email.trim())) {
      errors.push(`email looks invalid ("${row.email}")`)
    }
  })
}

export function validateClassrooms(rows) {
  return validateGeneric(rows, CLASSROOM_COLUMNS, 'classroom_id', (row, errors) => {
    if (row.status && !['Available', 'Unavailable'].includes(row.status.trim())) {
      errors.push(`status must be Available or Unavailable (got "${row.status}")`)
    }
    if (row.capacity && Number.isNaN(Number(row.capacity))) {
      errors.push(`capacity must be a number (got "${row.capacity}")`)
    }
  })
}

export function validateExams(rows) {
  // classroom_id is optional (section 5): support schedules without rooms
  const hasClassroomCol = rows.length > 0 && 'classroom_id' in rows[0]
  const requiredColumns = hasClassroomCol ? [...EXAM_COLUMNS_BASE, 'classroom_id'] : EXAM_COLUMNS_BASE

  return validateGeneric(rows, requiredColumns, 'exam_id', (row, errors) => {
    if (row.date && !isValidDate(row.date)) {
      errors.push(`date must be YYYY-MM-DD (got "${row.date}")`)
    }
    if (row.start_time && !isValidTime(row.start_time)) {
      errors.push(`start_time must be HH:MM 24h (got "${row.start_time}")`)
    }
    if (row.end_time && !isValidTime(row.end_time)) {
      errors.push(`end_time must be HH:MM 24h (got "${row.end_time}")`)
    }
    if (row.shift && !['Morning', 'Afternoon', 'Evening'].includes(row.shift.trim())) {
      errors.push(`shift should be Morning, Afternoon or Evening (got "${row.shift}")`)
    }
  })
}

function validateGeneric(rows, requiredColumns, idField, extraValidator) {
  const missingColumns = []
  if (rows.length > 0) {
    const actualColumns = Object.keys(rows[0])
    for (const col of requiredColumns) {
      if (!actualColumns.includes(col)) missingColumns.push(col)
    }
  }

  const validRows = []
  const invalidRows = []
  const seenIds = new Set()

  rows.forEach((row, index) => {
    const errors = []
    const isEmptyRow = Object.values(row).every((v) => !v || String(v).trim() === '')
    if (isEmptyRow) return // silently skip truly empty lines

    for (const col of requiredColumns) {
      if (missingColumns.includes(col)) continue
      const val = row[col]
      if (val === undefined || val === null || String(val).trim() === '') {
        errors.push(`${col} is missing`)
      }
    }

    const id = row[idField]?.trim()
    if (id) {
      if (seenIds.has(id)) {
        errors.push(`duplicate ${idField} "${id}"`)
      } else {
        seenIds.add(id)
      }
    }

    if (extraValidator) extraValidator(row, errors)

    if (errors.length > 0) {
      invalidRows.push({ row, index: index + 2, errors }) // +2: header row + 1-index
    } else {
      validRows.push(normalizeRow(row))
    }
  })

  return { validRows, invalidRows, missingColumns }
}

function normalizeRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

// ---- Mapping raw CSV rows to DB record shape --------------------------

export function teacherRowToRecord(row) {
  return {
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    department: row.department,
    email: row.email,
    phone: row.phone,
    status: row.status || 'Active'
  }
}

export function classroomRowToRecord(row) {
  return {
    classroomId: row.classroom_id,
    classroomName: row.classroom_name,
    building: row.building,
    floor: row.floor,
    capacity: Number(row.capacity) || 0,
    status: row.status || 'Available'
  }
}

export function examRowToRecord(row) {
  return {
    examId: row.exam_id,
    date: row.date,
    day: row.day,
    shift: row.shift,
    startTime: row.start_time,
    endTime: row.end_time,
    subject: row.subject
  }
}

// ---- Export helpers -----------------------------------------------------

export function downloadCsv(filename, rows) {
  const csv = Papa.unparse(rows)
  downloadBlob(filename, csv, 'text/csv;charset=utf-8;')
}

export function downloadJson(filename, obj) {
  downloadBlob(filename, JSON.stringify(obj, null, 2), 'application/json')
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
