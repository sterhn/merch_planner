import { describe, expect, it } from 'vitest'
import { formatDate, formatMonth, formatRub, localMonth, monthKey, monthRange, toISODate, todayISO, currentMonth } from './format'

describe('formatRub', () => {
  it('formats numbers with the ruble sign', () => {
    expect(formatRub(1500)).toMatch(/1\s500\s₽/u)
  })
  it('shows a dash for null/undefined', () => {
    expect(formatRub(null)).toBe('—')
    expect(formatRub(undefined)).toBe('—')
  })
})

describe('formatDate', () => {
  it('renders a date-only string as the same calendar day regardless of timezone', () => {
    // Parsed as UTC this would show 05.07.2026 in negative-offset timezones.
    expect(formatDate('2026-07-06')).toBe('06.07.2026')
    expect(formatDate('2026-01-01')).toBe('01.01.2026')
  })
  it('shows a dash for empty values and passes through unparseable ones', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('monthKey', () => {
  it('returns YYYY-MM', () => {
    expect(monthKey('2026-07-06')).toBe('2026-07')
  })
})

describe('localMonth', () => {
  it('uses the local timezone month for a timestamp', () => {
    // Mid-month noon UTC is the same month in every timezone.
    expect(localMonth('2026-07-15T12:00:00Z')).toBe('2026-07')
    // Same instant, expressed with an offset.
    expect(localMonth('2026-07-15T15:00:00+03:00')).toBe('2026-07')
  })
  it('falls back to monthKey for unparseable values', () => {
    expect(localMonth('not-a-timestamp')).toBe('not-a-t')
  })
})

describe('monthRange', () => {
  it('spans a year boundary inclusively', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('returns a single month when from equals to', () => {
    expect(monthRange('2026-07', '2026-07')).toEqual(['2026-07'])
  })
  it('returns nothing when from is after to', () => {
    expect(monthRange('2026-08', '2026-07')).toEqual([])
  })
})

describe('formatMonth', () => {
  it('renders YYYY-MM as an English month label', () => {
    expect(formatMonth('2026-07')).toBe('July 2026')
    expect(formatMonth('2025-12')).toBe('December 2025')
  })
  it('passes through unparseable values', () => {
    expect(formatMonth('not-a-month')).toBe('not-a-month')
  })
})

describe('toISODate / todayISO / currentMonth', () => {
  it('formats the local calendar day, not UTC', () => {
    expect(toISODate(new Date(2026, 6, 6))).toBe('2026-07-06')
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(todayISO()).toBe(expected)
    expect(currentMonth()).toBe(expected.slice(0, 7))
  })
})
