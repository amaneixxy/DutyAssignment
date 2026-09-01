# Duty Desk — Exam Management & Teacher Duty Allocation System

A fully local, offline-first exam management system for schools/colleges. No backend, no
database server, no login, no internet connection required after install. All data lives in
your browser's IndexedDB, with full CSV and JSON import/export for backup and transfer.

## Features

- Teacher, classroom, and exam management (CRUD, search, filters)
- CSV import with row-level validation and an import preview (append or replace)
- Automatic teacher duty allocation: 2 primary + 1 backup per classroom by default, using a
  scoring algorithm that balances total duty count, avoids double-booking, and softly avoids
  repeated classroom/teacher pairings
- Manual reassignment with conflict validation and a full audit history
- Teacher absence handling: automatically promotes the backup to primary and finds a new backup
- Reports: teacher duty summary, workload (most/least assigned), date-wise, classroom-wise,
  and unassigned/conflict reports
- JSON backup & restore, CSV export for every entity, and a printable daily duty sheet
- Demo data generator so you can try the whole workflow without importing anything

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173) in your browser. The app
works completely offline once dependencies are installed — there is no server component.

## Project structure

```
src/
├── algorithms/dutyAllocation.js   # framework-free allocation + absence-reassignment logic
├── services/                      # Dexie (IndexedDB) access, CSV, backup, demo data
├── hooks/                         # live-query React hooks over Dexie
├── components/                    # layout, common UI, tables
└── pages/                         # one file per route, matching the sidebar navigation
```

## CSV formats

**Teachers** — `teacher_id,teacher_name,department,email,phone,status`
**Classrooms** — `classroom_id,classroom_name,building,floor,capacity,status`
**Exam schedule** — `exam_id,date,day,shift,start_time,end_time,subject[,classroom_id]`

`classroom_id` on the exam schedule is optional — if omitted, assign rooms afterwards on the
**Exam Schedule** page before generating duties.

## Data storage & backup

All data is stored locally in this browser's IndexedDB (database name `examDutyDeskDB`).
Clearing your browser's site data will erase it — use **Backup & Restore → Export All Data**
regularly to keep a JSON snapshot you can restore later or move to another machine.

## Tests

```bash
npm run test
```

Runs unit tests for the allocation algorithm (duty-count prioritization, no double-booking,
availability exclusion, backup uniqueness, shortage warnings, absence promotion, etc).
