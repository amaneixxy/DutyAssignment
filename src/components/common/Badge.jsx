import React from 'react'

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  blue: 'bg-brand-50 text-brand-700 border-brand-200',
  gray: 'bg-ink-100 text-ink-600 border-ink-200'
}

export default function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
