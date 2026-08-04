import AnimatedNumber from './AnimatedNumber'

export type StatTone = 'good' | 'bad' | 'brand'

const BORDER: Record<StatTone, string> = {
  good: 'border-l-good',
  bad: 'border-l-bad',
  brand: 'border-l-brand',
}

const TEXT: Record<StatTone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  brand: 'text-brand',
}

/** Small headline-number tile for a row of dashboard stats. */
export default function StatTile({
  label,
  value,
  tone = 'brand',
  format,
  index = 0,
}: {
  label: string
  value: number
  tone?: StatTone
  format?: (n: number) => string
  /** Staggers the entry animation when several tiles sit in a row. */
  index?: number
}) {
  return (
    <div
      className={`animate-pop rounded-card border-l-4 ${BORDER[tone]} bg-surface p-3 shadow-card`}
      style={{ animationDelay: `${(index + 1) * 60}ms` }}
    >
      <p className={`font-display text-base leading-tight ${TEXT[tone]}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="mt-0.5 text-2xs text-ink-faint">{label}</p>
    </div>
  )
}
