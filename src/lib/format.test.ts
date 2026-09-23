import { describe, expect, it } from 'vitest'
import {
  currentMonth,
  daysFromTodayISO,
  formatDate,
  formatMonth,
  formatRub,
  localMonth,
  monthKey,
  monthRange,
  parseCount,
  parseMoney,
  toISODate,
  todayISO,
} from './format'

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

describe('parseMoney', () => {
  it('accepts the comma decimal separator a Russian keyboard produces', () => {
    expect(parseMoney('1,5')).toBe(1.5)
    expect(parseMoney('1.5')).toBe(1.5)
    expect(parseMoney(' 1200 ')).toBe(1200)
  })
  it('treats blank as not-set rather than zero', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
  })
  it('rejects values that are not numbers', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('1,2,3')).toBeNull()
  })
  it('accepts space thousands separators, including no-break spaces', () => {
    expect(parseMoney('1 500')).toBe(1500)
    expect(parseMoney('1 500')).toBe(1500)
    expect(parseMoney('12 500,50')).toBe(12500.5)
  })
  it('reads back what formatRub prints', () => {
    expect(parseMoney(formatRub(1250))).toBe(1250)
    expect(parseMoney(formatRub(1234.5))).toBe(1234.5)
  })
  it('ignores a trailing ruble sign or abbreviation', () => {
    expect(parseMoney('1500 ₽')).toBe(1500)
    expect(parseMoney('1500р')).toBe(1500)
    expect(parseMoney('1 500 руб.')).toBe(1500)
    expect(parseMoney('₽')).toBeNull()
  })
})

describe('parseCount', () => {
  it('rounds to a whole number', () => {
    expect(parseCount('3')).toBe(3)
    expect(parseCount('2,6')).toBe(3)
  })
  it('clamps to the given minimum', () => {
    expect(parseCount('0', 1)).toBe(1)
    expect(parseCount('-5', 1)).toBe(1)
    expect(parseCount('-5')).toBe(0)
  })
  it('treats blank as not-set and rejects junk', () => {
    expect(parseCount('')).toBeNull()
    expect(parseCount('abc')).toBeNull()
  })
  it('accepts numbers as well as strings', () => {
    expect(parseCount(4)).toBe(4)
  })
})

describe('daysFromTodayISO', () => {
  it('steps whole calendar days', () => {
    expect(daysFromTodayISO(0)).toBe(todayISO())
    const week = daysFromTodayISO(7)
    expect(week > todayISO()).toBe(true)
    expect(week).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('lands on a real date across a month boundary', () => {
    expect(daysFromTodayISO(45)).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  })
})
