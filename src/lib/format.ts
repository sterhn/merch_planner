// Hoisted: AnimatedNumber calls formatRub once per animation frame, per instance.
const RUB = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export function formatRub(value: number | null | undefined): string {
  if (value == null) return '—'
  // Non-breaking space so the ₽ never wraps to its own line
  return RUB.format(value) + ' ₽'
}

/**
 * Parses a money field. Accepts the comma decimal separator a Russian keyboard
 * produces — `Number('1,5')` is NaN. Pair with `type="text" inputMode="decimal"`
 * inputs: a `type="number"` input rejects the comma before this ever runs.
 * Blank means "not set" (null), not zero.
 *
 * Also accepts space thousands separators — typed ("1 500"), or the no-break
 * spaces formatRub prints, so an amount copied from the app or a bank app
 * pastes back cleanly — and a trailing ₽ / р / руб. Without this "1 500"
 * parsed as null: an expense saved as 0 ₽, a price or total silently cleared.
 */
export function parseMoney(input: string): number | null {
  const trimmed = input
    .replace(/\s/g, '')
    .replace(/(₽|руб\.?|р\.?)$/i, '')
    .replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/**
 * Parses a whole-number field (quantities, stock). Blank means "not set" (null).
 * `min` clamps the result — 1 for line quantities, 0 for counts that may be zero.
 */
export function parseCount(input: string | number, min = 0): number | null {
  if (typeof input === 'string' && input.trim() === '') return null
  const n = typeof input === 'number' ? input : Number(input.trim().replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.round(n))
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

/**
 * Month (YYYY-MM) of a timestamp in the user's local timezone. monthKey on a
 * raw timestamptz slices the UTC month, which is off by one near midnight on
 * month boundaries. Not for date-only strings — those parse as UTC midnight;
 * keep using monthKey for them.
 */
export function localMonth(timestamp: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return monthKey(timestamp)
  return toISODate(d).slice(0, 7)
}

/** Every month key from `from` to `to` inclusive (both YYYY-MM). */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))]
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** "2026-07" → "July 2026" (period labels; UI copy is English). */
export function formatMonth(month: string): string {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  if (Number.isNaN(d.getTime())) return month
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** A Date as YYYY-MM-DD in the user's local timezone (not UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today as YYYY-MM-DD in the user's local timezone. */
export function todayISO(): string {
  return toISODate(new Date())
}

/** A timestamp as a `type="date"` input value (local YYYY-MM-DD); '' for none. */
export function dateInputValue(timestamp: string | null | undefined): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return Number.isNaN(d.getTime()) ? '' : toISODate(d)
}

/**
 * A date input's YYYY-MM-DD as a timestamp at local noon. Noon, not midnight,
 * so no timezone offset can tip it into the neighbouring day — or month.
 */
export function localNoonISO(date: string): string {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12).toISOString()
}

/**
 * `days` from today as YYYY-MM-DD. Steps the date component rather than adding
 * milliseconds, which lands on the wrong day across a DST boundary.
 */
export function daysFromTodayISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Current month as YYYY-MM in the user's local timezone. */
export function currentMonth(): string {
  return todayISO().slice(0, 7)
}
