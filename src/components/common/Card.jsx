import React from 'react'

export default function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-white rounded-xl border border-ink-100 shadow-card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-5">
          {title && <h3 className="font-display font-semibold text-ink-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
