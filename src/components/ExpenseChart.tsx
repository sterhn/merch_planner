import { useCallback, useState } from 'react'
import { formatMonth, formatRub } from '../lib/format'
import { haptic } from '../lib/haptics'

export interface MonthTotal {
  month: string
  total: number
}

const SLOT = 36
const BAR = 20
const TOP_PAD = 14
const PLOT_H = 110
const LABEL_H = 18

/** Smallest "nice" tick step (1/2/2.5/5 × 10ⁿ) that is ≥ rough. */
function niceStep(rough: number): number {
  const pow = 10 ** Math.floor(Math.log10(rough))
  for (const mult of [1, 2, 2.5, 5, 10]) if (mult * pow >= rough) return mult * pow
  return 10 * pow
}

function compactTick(value: number): string {
  return value >= 1000 ? `${value / 1000}k` : String(value)
}

/** Bar with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2)
  return `M${x} ${y + h} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h} Z`
}

function monthLabel(month: string, index: number): string {
  const mm = month.slice(5, 7)
  const name = new Date(Number(month.slice(0, 4)), Number(mm) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short' })
  // Anchor the year at January and at the left edge of the chart.
  return index === 0 || mm === '01' ? `${name} ${month.slice(2, 4)}` : name
}

/**
 * Monthly totals as a tappable bar chart. `months` must be a contiguous,
 * chronologically ascending list (gaps pre-filled with 0) and non-empty.
 */
export default function ExpenseChart({ months }: { months: MonthTotal[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const active = months.find((m) => m.month === selected) ?? months[months.length - 1]

  // Measure once so few months stretch to fill the card, and start scrolled
  // to the most recent month (runs once on mount).
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      setContainerWidth(el.clientWidth)
      el.scrollLeft = el.scrollWidth
    }
  }, [])

  const max = Math.max(...months.map((m) => m.total), 1)
  const step = niceStep(max / 3)
  const yMax = step * Math.ceil(max / step)
  const ticks = Array.from({ length: Math.round(yMax / step) }, (_, i) => (i + 1) * step)

  const slot = Math.max(SLOT, Math.floor(containerWidth / months.length))
  const width = months.length * slot
  const height = TOP_PAD + PLOT_H + LABEL_H
  const baseline = TOP_PAD + PLOT_H
  const labelEvery = months.length > 20 ? 2 : 1

  return (
    <section className="mb-5 animate-pop rounded-card bg-surface p-4 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Monthly expenses</p>
      <div className="mt-1 mb-2 flex items-baseline justify-between gap-2">
        <p className="font-display text-sm">{formatMonth(active.month)}</p>
        <p className="font-display text-sm text-bad">−{formatRub(active.total)}</p>
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Bar chart of total expenses per month"
          className="block"
        >
          {ticks.map((t) => {
            const y = baseline - (t / yMax) * PLOT_H
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={width} y2={y} stroke="var(--color-line)" strokeWidth={1} />
                <text x={width - 2} y={y - 3} textAnchor="end" fontSize={9} fill="var(--color-ink-faint)">
                  {compactTick(t)}
                </text>
              </g>
            )
          })}
          <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="var(--color-line)" strokeWidth={1} />
          {months.map((m, i) => {
            const x = i * slot + (slot - BAR) / 2
            const h = (m.total / yMax) * PLOT_H
            const isActive = m.month === active.month
            return (
              <g key={m.month}>
                {m.total > 0 ? (
                  <path
                    d={barPath(x, baseline - h, BAR, h)}
                    fill="var(--color-brand)"
                    fillOpacity={isActive ? 1 : 0.4}
                  />
                ) : (
                  <rect x={x} y={baseline - 2} width={BAR} height={2} fill="var(--color-line)" />
                )}
                {(months.length - 1 - i) % labelEvery === 0 && (
                  <text
                    x={i * slot + slot / 2}
                    y={baseline + 13}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isActive ? 'var(--color-ink)' : 'var(--color-ink-faint)'}
                    fontWeight={isActive ? 700 : 400}
                  >
                    {monthLabel(m.month, i)}
                  </text>
                )}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  onClick={() => {
                    haptic()
                    setSelected(m.month)
                  }}
                >
                  <title>{`${formatMonth(m.month)}: ${formatRub(m.total)}`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
