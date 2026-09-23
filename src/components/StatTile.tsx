import type { LucideIcon } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import { TONE_BLOB, TONE_TEXT, type Tone } from './tones'

export type StatTone = Extract<Tone, 'good' | 'bad' | 'brand'>

/** Small headline-number tile for a row of dashboard stats. */
export default function StatTile({
  label,
  value,
  tone = 'brand',
  icon: Icon,
  format,
  index = 0,
}: {
  label: string
  value: number
  tone?: StatTone
  icon?: LucideIcon
  format?: (n: number) => string
  /** Staggers the entry animation when several tiles sit in a row. */
  index?: number
}) {
  return (
    <div
      className="flex animate-pop items-center gap-3 rounded-card bg-surface p-3.5 shadow-card"
      style={{ animationDelay: `${(index + 1) * 60}ms` }}
    >
      {Icon && (
        <span className={`grid size-10 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB[tone]}`} aria-hidden>
          <Icon size={19} strokeWidth={2.3} />
        </span>
      )}
      <div className="min-w-0">
        <p className={`truncate font-display text-base leading-tight ${TONE_TEXT[tone]}`}>
          <AnimatedNumber value={value} format={format} />
        </p>
        <p className="mt-0.5 text-2xs font-semibold text-ink-faint">{label}</p>
      </div>
    </div>
  )
}
