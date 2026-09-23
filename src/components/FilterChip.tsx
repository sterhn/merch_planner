import type { ReactNode } from 'react'
import { haptic } from '../lib/haptics'

export default function FilterChip({ active, onClick, tone = 'brand', count, children }: {
  active: boolean
  onClick: () => void
  tone?: 'brand' | 'accent'
  /** How many rows the chip would show; rendered as a small bubble. */
  count?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(5)
        onClick()
      }}
      className={`tap flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-colors ${
        count !== undefined ? 'pr-2' : ''
      } ${
        active
          ? `${tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-brand text-on-brand'} animate-boing shadow-card`
          : 'glass text-ink-muted hover:text-ink'
      }`}
    >
      {children}
      {count !== undefined && (
        <span
          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-2xs tabular-nums ${
            active ? 'bg-on-brand/20' : 'bg-surface-2 text-ink-faint'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
