import React from 'react'

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
          <Icon size={22} />
        </div>
      )}
      <h3 className="font-display font-semibold text-ink-800">{title}</h3>
      {message && <p className="mt-1 text-sm text-ink-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
