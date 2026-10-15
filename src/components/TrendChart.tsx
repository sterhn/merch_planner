import { useCallback, useState } from 'react'
import { formatMonth, formatRub } from '../lib/format'
import { haptic } from '../lib/haptics'
import { compactTick, monthLabel, niceStep } from './chartScale'

export interface TrendSeries {
  key: string
  label: string
  /** A CSS colour token, e.g. var(--color-chart-1). */
  color: string
  values: number[]
}

const SLOT_MIN = 22
const PAD_TOP = 10
const PLOT_H = 140
const LABEL_H = 18
const PAD_X = 8
/** Strip on the right that holds the y-axis numbers, clear of the lines. */
const GUTTER = 30

/**
 * Monthly lines on one ₽ axis (zero always in view, so a loss reads as below
 * the line). Tap or hover a month to read every series there; the readout
 * above the plot doubles as the tooltip, and the table below is the
 * no-pointer way to every value.
 */
export default function TrendChart({
  months,
  series,
  title,
}: {
  /** Contiguous YYYY-MM keys, oldest first, non-empty. */
  months: string[]
  series: TrendSeries[]
  title: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [width, setWidth] = useState(0)
  const active = selected ?? months.length - 1

  // Fit the card; only a long history scrolls, and then it opens on the
  // latest month.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      setWidth(el.clientWidth)
      el.scrollLeft = el.scrollWidth
    }
  }, [])

  const all = series.flatMap((s) => s.values)
  const rawMax = Math.max(0, ...all)
  const rawMin = Math.min(0, ...all)
  const step = niceStep(Math.max(rawMax - rawMin, 1) / 4)
  const yMax = Math.ceil(rawMax / step) * step || step
  const yMin = Math.floor(rawMin / step) * step
  const ticks: number[] = []
  for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(t)

  const plotW = Math.max(width, months.length * SLOT_MIN + GUTTER)
  const right = plotW - GUTTER
  const slot = (right - PAD_X * 2) / Math.max(months.length - 1, 1)
  const x = (i: number) => (months.length === 1 ? right / 2 : PAD_X + i * slot)
  const y = (v: number) => PAD_TOP + ((yMax - v) / (yMax - yMin)) * PLOT_H
  const height = PAD_TOP + PLOT_H + LABEL_H
  const labelEvery = Math.ceil(months.length / Math.max(1, Math.floor(right / 44)))

  function pick(i: number) {
    if (i !== selected) haptic(4)
    setSelected(i)
  }

  return (
    <div>
      {/* Readout: values lead, series names follow. */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        <span className="font-display text-sm">{formatMonth(months[active])}</span>
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="font-display text-sm text-ink">{formatRub(s.values[active])}</span>
            {s.label}
          </span>
        ))}
      </div>

      <div ref={measure} className="overflow-x-auto">
        <svg
          width={plotW}
          height={height}
          viewBox={`0 0 ${plotW} ${height}`}
          role="img"
          aria-label={title}
          className="block touch-pan-x"
          onPointerLeave={() => setSelected(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '2 3'}
              />
              <text x={plotW - 2} y={y(t) - 3} textAnchor="end" fontSize={9} fill="var(--color-ink-faint)">
                {compactTick(t)}
              </text>
            </g>
          ))}

          {/* Crosshair on the active month */}
          <line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} stroke="var(--color-ink-faint)" strokeWidth={1} />

          {series.map((s) => (
            <polyline
              key={s.key}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.map((s) => (
            <circle
              key={s.key}
              cx={x(active)}
              cy={y(s.values[active])}
              r={4.5}
              fill={s.color}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ))}

          {months.map((m, i) =>
            (months.length - 1 - i) % labelEvery === 0 ? (
              <text
                key={m}
                x={x(i)}
                y={height - 4}
                textAnchor={i === 0 && months.length > 1 ? 'start' : 'middle'}
                fontSize={9}
                fill={i === active ? 'var(--color-ink)' : 'var(--color-ink-faint)'}
                fontWeight={i === active ? 700 : 400}
              >
                {monthLabel(m, i)}
              </text>
            ) : null,
          )}

          {/* Hit targets: a full-height column per month, wider than any mark. */}
          {months.map((m, i) => (
            <rect
              key={m}
              x={Math.max(0, x(i) - slot / 2)}
              y={0}
              width={slot}
              height={height}
              fill="transparent"
              onPointerEnter={() => pick(i)}
              onClick={() => pick(i)}
            />
          ))}
        </svg>
      </div>

      <details className="mt-2 text-xs">
        <summary className="tap inline-flex min-h-11 cursor-pointer items-center font-bold text-ink-muted">
          Show as table
        </summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <thead>
            <tr className="text-ink-faint">
              <th className="py-1 font-semibold">Month</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 text-right font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={m} className="border-t border-line">
                <td className="py-1">{formatMonth(m)}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {formatRub(s.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
