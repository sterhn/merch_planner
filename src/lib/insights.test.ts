import { describe, expect, it } from 'vitest'
import type { ExpenseFeedRow, Order, OrderItem, ShelfItem } from './types'
import {
  customerKey,
  customerStats,
  earliestMonth,
  fandomSales,
  itemSales,
  monthlyTrend,
  periodMonths,
} from './insights'

const order = (id: string, extra: Partial<Order>): Order =>
  ({ id, telegram: null, customer_email: null, paid: true, total_price: 0, created_at: '2026-05-15T12:00:00Z', paid_at: null, ...extra }) as Order
const line = (order_id: string, item_id: string | null, name_text: string | null, qty: number, unit_price: number | null) =>
  ({ order_id, item_id, name_text, qty, unit_price }) as OrderItem

describe('periodMonths', () => {
  it('counts back from the current month', () => {
    expect(periodMonths('3m', '2020-01', '2026-02')).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(periodMonths('12m', '2020-01', '2026-10')).toHaveLength(12)
  })

  it('starts "all time" at the earliest data', () => {
    expect(periodMonths('all', '2026-07', '2026-10')).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(periodMonths('all', 'junk', '2026-10')).toEqual(['2026-10'])
  })
})

describe('monthlyTrend', () => {
  const orders = [
    order('a', { total_price: 500, created_at: '2026-04-20T12:00:00Z', paid_at: '2026-05-02T12:00:00Z' }),
    order('b', { total_price: 300, created_at: '2026-05-10T12:00:00Z' }),
    order('c', { total_price: 999, paid: false, created_at: '2026-05-10T12:00:00Z' }),
  ]
  const shelf = [{ month: '2026-05', income: 100 }] as ShelfItem[]
  const expenses = [{ date: '2026-05-03', amount: 250 }, { date: '2026-04-01', amount: 50 }] as ExpenseFeedRow[]

  it('counts paid orders in the month they were paid, plus shelf income, minus expenses', () => {
    expect(monthlyTrend(orders, shelf, expenses, ['2026-04', '2026-05'])).toEqual([
      { month: '2026-04', revenue: 0, expenses: 50, net: -50 },
      { month: '2026-05', revenue: 900, expenses: 250, net: 650 },
    ])
  })

  it('finds the earliest month across everything', () => {
    expect(earliestMonth(orders, shelf, expenses)).toBe('2026-04')
  })
})

describe('itemSales / fandomSales', () => {
  const catalog = new Map([
    ['s', { name: 'Шейкер', fandom: 'msch' }],
    ['b', { name: 'Значок', fandom: 'tgcf' }],
    ['k', { name: 'Брелок', fandom: 'msch' }],
  ])
  const lines = [
    line('o1', 's', null, 1, 450),
    line('o1', 'b', null, 3, 200),
    line('o2', 'k', null, 1, 350),
    line('o2', null, 'Открытка', 2, 50),
    line('o3', 's', null, 9, 450), // order not in scope
  ]
  const sales = itemSales(lines, new Set(['o1', 'o2']), catalog)

  it('ranks items by units, only from the given orders', () => {
    expect(sales.map((s) => [s.name, s.units, s.revenue])).toEqual([
      ['Значок', 3, 600],
      ['Открытка', 2, 100],
      ['Шейкер', 1, 450],
      ['Брелок', 1, 350],
    ])
  })

  it('rolls up by fandom, custom lines under null', () => {
    expect(fandomSales(sales)).toEqual([
      { fandom: 'msch', units: 2, revenue: 800 },
      { fandom: 'tgcf', units: 3, revenue: 600 },
      { fandom: null, units: 2, revenue: 100 },
    ])
  })
})

describe('customers', () => {
  it('treats @Name, name and t.me/name as one person', () => {
    expect(customerKey({ telegram: '@Bob_M', customer_email: null })).toBe('tg:bob_m')
    expect(customerKey({ telegram: 'https://t.me/bob_m', customer_email: 'x@y' })).toBe('tg:bob_m')
    expect(customerKey({ telegram: null, customer_email: ' Eve@Mail.ru ' })).toBe('email:eve@mail.ru')
    expect(customerKey({ telegram: '', customer_email: null })).toBeNull()
  })

  it('sums paid orders per customer, biggest spender first', () => {
    const stats = customerStats([
      order('1', { telegram: '@bob_m', total_price: 500, created_at: '2026-01-01T00:00:00Z' }),
      order('2', { telegram: 'bob_m', total_price: 300, created_at: '2026-03-01T00:00:00Z' }),
      order('3', { telegram: '@bob_m', total_price: 999, paid: false }),
      order('4', { customer_email: 'eve@mail.ru', total_price: 600 }),
      order('5', { total_price: 100 }),
    ])
    expect(stats.map((s) => [s.label, s.orders, s.spend])).toEqual([
      ['@bob_m', 2, 800],
      ['eve@mail.ru', 1, 600],
    ])
    expect(stats[0].lastOrder).toBe('2026-03-01T00:00:00Z')
    expect(stats[0].lastOrderId).toBe('2')
  })
})
