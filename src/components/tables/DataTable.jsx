import React, { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from '../common/EmptyState.jsx'
import { Inbox } from 'lucide-react'

/**
 * columns: [{ key, label, sortable, render(row) }]
 */
export default function DataTable({ columns, rows, pageSize = 15, onRowClick, emptyTitle = 'No records found', emptyMessage }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === bv) return 0
      const result = av > bv ? 1 : -1
      return sortDir === 'asc' ? result : -result
    })
    return copy
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  if (rows.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-ink-500">
              {columns.map((col) => (
                <th key={col.key} className="px-5 py-2.5 font-medium whitespace-nowrap">
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-ink-800 focus-ring rounded"
                    >
                      {col.label}
                      {sortKey === col.key &&
                        (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={row.id ?? row.teacherId ?? row.classroomId ?? row.examId ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-ink-50 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-ink-50' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-2.5 text-ink-700 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm text-ink-500">
          <span>
            Page {clampedPage + 1} of {totalPages} &middot; {rows.length} records
          </span>
          <div className="flex gap-1">
            <button
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-md border border-ink-200 disabled:opacity-40 hover:bg-ink-50 focus-ring"
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="p-1.5 rounded-md border border-ink-200 disabled:opacity-40 hover:bg-ink-50 focus-ring"
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
