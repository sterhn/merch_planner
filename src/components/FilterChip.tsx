import type { ReactNode } from 'react'
import { haptic } from '../lib/haptics'

export default function FilterChip({ active, onClick, tone = 'brand', children }: {
  active: boolean
  onClick: () => void
  tone?: 'brand' | 'accent'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(5)
        onClick()
      }}
      className={`tap h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${
        active
          ? `${tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-brand text-on-brand'} animate-boing shadow-card`
          : 'bg-surface text-ink-muted shadow-card hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
