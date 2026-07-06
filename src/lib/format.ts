export function formatRub(value: number | null | undefined): string {
  if (value == null) return '—'
  // Non-breaking space so the ₽ never wraps to its own line
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' ₽'
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // Date-only strings must be parsed as local dates: new Date('2026-07-06')
  // means UTC midnight and renders as the previous day west of Greenwich.
  const d = DATE_ONLY.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU')
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** A Date as YYYY-MM-DD in the user's local timezone (not UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today as YYYY-MM-DD in the user's local timezone. */
export function todayISO(): string {
  return toISODate(new Date())
}

/** Current month as YYYY-MM in the user's local timezone. */
export function currentMonth(): string {
  return todayISO().slice(0, 7)
}
