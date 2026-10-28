import { Check } from 'lucide-react'
import { haptic } from '../lib/haptics'
import { celebrate } from '../lib/confetti'

export default function StatusBadge({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick?: () => void
}) {
  // Off state is ink-muted, not ink-faint: faint on surface-2 is 2.9:1, under
  // the 4.5:1 small bold text needs.
  const cls = on ? 'bg-good/10 text-good' : 'bg-surface-2 text-ink-muted'
  if (onClick) {
    // Solid when on: the translucent tint read as muddy over the foil (2.3:1).
    const toggle = on ? 'bg-good text-on-good shadow-card' : 'glass text-ink-muted'
    return (
      <button
        onClick={(e) => {
          haptic()
          // Switching a status on is a small win — throw a little confetti.
          if (!on) celebrate(e.currentTarget)
          onClick()
        }}
        aria-pressed={on}
        className={`tap inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold ${toggle}`}
      >
        {on && <Check size={14} strokeWidth={3} className="animate-boing" />}
        {label}
      </button>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold ${cls}`}>
      {on && <Check size={11} strokeWidth={3} />}
      {label}
    </span>
  )
}
