import type { ReactNode } from 'react'

export interface BarRow {
  key: string
  label: ReactNode
  /** Drives the bar length. */
  value: number
  /** What the row prints (formatted value, plus any secondary figure). */
  display: ReactNode
  /** Full description for hover / screen readers. */
  title: string
}

/**
 * A ranked list with one-hue bars — magnitude only, so a single sequential
 * colour (chart-1). Labels and values stay in ink, the bar carries length.
 */
export default function BarList({ rows, empty }: { rows: BarRow[]; empty: string }) {
  if (rows.length === 0) return <p className="py-3 text-sm text-ink-faint">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} title={r.title}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">{r.display}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
