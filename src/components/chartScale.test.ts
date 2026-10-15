import { describe, expect, it } from 'vitest'
import { compactTick, monthLabel, niceStep } from './chartScale'

describe('chartScale', () => {
  it('rounds steps up to 1/2/2.5/5 × 10ⁿ', () => {
    expect(niceStep(730)).toBe(1000)
    expect(niceStep(180)).toBe(200)
    expect(niceStep(2100)).toBe(2500)
  })

  it('abbreviates thousands and keeps the minus sign', () => {
    expect(compactTick(2500)).toBe('2.5k')
    expect(compactTick(-1000)).toBe('−1k')
    expect(compactTick(0)).toBe('0')
  })

  it('shows the year at the first label and at January', () => {
    expect(monthLabel('2026-03', 0)).toBe('Mar 26')
    expect(monthLabel('2026-03', 2)).toBe('Mar')
    expect(monthLabel('2027-01', 5)).toBe('Jan 27')
  })
})
