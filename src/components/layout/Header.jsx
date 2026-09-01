import React from 'react'
import { Menu } from 'lucide-react'

export default function Header({ title, subtitle, onMenuClick, actions }) {
  return (
    <header className="no-print sticky top-0 z-20 bg-ink-50/90 backdrop-blur border-b border-ink-100">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-md text-ink-600 hover:bg-ink-100 focus-ring"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-lg text-ink-900 truncate">{title}</h1>
            {subtitle && <p className="text-sm text-ink-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
