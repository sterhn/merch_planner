// Axis helpers shared by the expense and trend charts.

/** Smallest "nice" tick step (1/2/2.5/5 × 10ⁿ) that is ≥ rough. */
export function niceStep(rough: number): number {
  const pow = 10 ** Math.floor(Math.log10(rough))
  for (const mult of [1, 2, 2.5, 5, 10]) if (mult * pow >= rough) return mult * pow
  return 10 * pow
}

/** 2500 → "2.5k", −1000 → "−1k". */
export function compactTick(value: number): string {
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  return sign + (abs >= 1000 ? `${abs / 1000}k` : String(abs))
}

/** "Mar", with the year at January and at the left edge: "Jan 26". */
export function monthLabel(month: string, index: number): string {
  const mm = month.slice(5, 7)
  const name = new Date(Number(month.slice(0, 4)), Number(mm) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  return index === 0 || mm === '01' ? `${name} ${month.slice(2, 4)}` : name
}
