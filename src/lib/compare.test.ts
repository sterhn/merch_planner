import { describe, expect, it } from 'vitest'
import { monthChange } from './compare'

describe('monthChange', () => {
  it('reports a rise in revenue as good', () => {
    expect(monthChange(1200, 1000, '2026-09', { toDate: false, upIsGood: true })).toEqual({
      text: '▲ 20% vs Sep',
      good: true,
      title: 'Compared with all of Sep',
    })
  })

  it('reports a rise in expenses as bad', () => {
    expect(monthChange(1500, 1000, '2026-09', { toDate: false, upIsGood: false })?.good).toBe(false)
  })

  it('reports a fall with a down arrow', () => {
    expect(monthChange(870, 1000, '2026-01', { toDate: true, upIsGood: true })).toEqual({
      text: '▼ 13% vs Jan',
      good: false,
      title: 'Compared with the same days of Jan',
    })
  })

  it('says "same" when nothing moved', () => {
    expect(monthChange(1001, 1000, '2026-09', { toDate: false, upIsGood: false })?.text).toBe('same as Sep')
  })

  it('has nothing to say against an empty month', () => {
    expect(monthChange(500, 0, '2026-09', { toDate: false, upIsGood: true })).toBeUndefined()
  })
})
