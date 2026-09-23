import { describe, expect, it } from 'vitest'
import { dayPart, daysBetween, dueLabel } from './greeting'

describe('dayPart', () => {
  it('splits the day at 5, 12, 17 and 22', () => {
    expect(dayPart(4)).toBe('night')
    expect(dayPart(5)).toBe('morning')
    expect(dayPart(11)).toBe('morning')
    expect(dayPart(12)).toBe('afternoon')
    expect(dayPart(17)).toBe('evening')
    expect(dayPart(22)).toBe('night')
    expect(dayPart(0)).toBe('night')
  })
})

describe('daysBetween', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4)
    expect(daysBetween('2026-09-23', '2026-09-23')).toBe(0)
  })
})

describe('dueLabel', () => {
  it('reads naturally', () => {
    expect(dueLabel(0)).toBe('today')
    expect(dueLabel(1)).toBe('tomorrow')
    expect(dueLabel(6)).toBe('in 6 days')
  })
  it('says how far past the deadline an overdue one is', () => {
    expect(dueLabel(-1)).toBe('1 day overdue')
    expect(dueLabel(-4)).toBe('4 days overdue')
  })
})
