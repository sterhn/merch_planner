import { describe, expect, it } from 'vitest'
import { monthChange, periodTotals } from './compare'

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

describe('periodTotals', () => {
  // Noon UTC, so the local calendar date is the same in any timezone a test runs in.
  const data = {
    orders: [
      { paid: true, paid_at: '2026-09-05T12:00:00Z', created_at: '2026-08-30T12:00:00Z', total_price: 1000 },
      { paid: true, paid_at: '2026-09-25T12:00:00Z', created_at: '2026-09-20T12:00:00Z', total_price: 500 },
      // Paid before paid_at existed: counts in the month it was created.
      { paid: true, paid_at: null, created_at: '2026-09-10T12:00:00Z', total_price: 200 },
      { paid: false, paid_at: null, created_at: '2026-09-02T12:00:00Z', total_price: 9999 },
    ],
    shelf: [{ month: '2026-09', income: 300 }],
    expenses: [
      { date: '2026-09-03', amount: 40 },
      { date: '2026-09-28', amount: 60 },
      { date: '2026-10-01', amount: 7 },
    ],
  }

  it('counts paid orders in the month they were paid, plus shelf income', () => {
    expect(periodTotals(data, '2026-09')).toEqual({ revenue: 2000, expenses: 100 })
  })

  it('cuts a month off at a day, taking that share of the shelf income', () => {
    // 10 of September's 30 days: 1000 + 200 from orders, 100 of the 300 shelf.
    expect(periodTotals(data, '2026-09', 10)).toEqual({ revenue: 1300, expenses: 40 })
  })

  it('counts everything for all time', () => {
    expect(periodTotals(data, 'all')).toEqual({ revenue: 2000, expenses: 107 })
  })
})
