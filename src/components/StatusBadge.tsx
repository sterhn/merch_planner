import { Check } from 'lucide-react'
import { haptic } from '../lib/haptics'

export default function StatusBadge({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick?: () => void
}) {
  const cls = on ? 'bg-good/15 text-good' : 'bg-surface-2 text-ink-faint'
  if (onClick) {
    return (
      <button
        onClick={() => {
          haptic()
          onClick()
        }}
        className={`tap inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold ${cls}`}
      >
        {on && <Check size={14} strokeWidth={3} />}
        {label}
      </button>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      {on && <Check size={11} strokeWidth={3} />}
      {label}
    </span>
  )
}
