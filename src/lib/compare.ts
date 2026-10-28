// "▲ 12% vs Sep" lines for the dashboard tiles.

export interface Change {
  text: string
  /** Whether the change is good news — picks the colour. */
  good: boolean
  /** Longer explanation, for a tooltip. */
  title: string
}

/** "2026-09" → "Sep". */
function shortMonth(month: string): string {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  })
}

/**
 * This period against `month` (YYYY-MM). `toDate` says the earlier figure
 * covers only the same days of that month (the current month is still under
 * way). `upIsGood`: more revenue is good, more expenses isn't. There's nothing
 * to compare against a month with nothing in it.
 */
export function monthChange(
  current: number,
  previous: number,
  month: string,
  { toDate, upIsGood }: { toDate: boolean; upIsGood: boolean },
): Change | undefined {
  if (previous <= 0) return undefined
  const pct = Math.round(((current - previous) / previous) * 100)
  const short = shortMonth(month)
  const title = toDate ? `Compared with the same days of ${short}` : `Compared with all of ${short}`
  if (pct === 0) return { text: `same as ${short}`, good: true, title }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${short}`, good: pct > 0 === upIsGood, title }
}
