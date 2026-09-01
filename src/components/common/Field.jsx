import React from 'react'

export function Field({ label, children, hint, required }) {
  return (
    <label className="block text-sm mb-3">
      <span className="block mb-1 font-medium text-ink-700">
        {label} {required && <span className="text-coral-500">*</span>}
      </span>
      {children}
      {hint && <span className="block mt-1 text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus-ring focus-visible:border-brand-400 ${props.className || ''}`}
    />
  )
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-ink-200 px-3 py-2 text-sm bg-white focus-ring focus-visible:border-brand-400 ${props.className || ''}`}
    />
  )
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus-ring focus-visible:border-brand-400 ${props.className || ''}`}
    />
  )
}
