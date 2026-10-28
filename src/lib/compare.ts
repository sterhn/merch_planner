// The dashboard's money for a period, and its "▲ 12% vs Sep" lines.

import type { ExpenseFeedRow, Order, ShelfItem } from './types'
import { localISODate, monthKey } from './format'

export interface PeriodTotals {
  revenue: number
  expenses: number
}

/**
 * Revenue and expenses for `period` ('all' or YYYY-MM), by the dashboard's
 * rule: an order counts in the month it was paid (created, for orders paid
 * before paid_at existed), plus the archived shelf's income for the month.
 * `upToDay` cuts a month off after that day (1–31), for comparing a month
 * still under way with the same days of the one before. Shelf rows carry a
 * month but no day, so a cut month takes that share of its shelf income.
 */
export function periodTotals(
  data: {
    orders: readonly Pick<Order, 'paid' | 'paid_at' | 'created_at' | 'total_price'>[]
    shelf: readonly Pick<ShelfItem, 'month' | 'income'>[]
    expenses: readonly Pick<ExpenseFeedRow, 'date' | 'amount'>[]
  },
  period: string,
  upToDay = 31,
): PeriodTotals {
  const inPeriod = (month: string | null) => period === 'all' || month === period
  const byDay = (isoDate: string) => Number(isoDate.slice(8, 10)) <= upToDay

  const orderRevenue = data.orders
    .filter((o) => {
      if (!o.paid) return false
      const day = localISODate(o.paid_at ?? o.created_at)
      return inPeriod(day.slice(0, 7)) && byDay(day)
    })
    .reduce((s, o) => s + (o.total_price ?? 0), 0)

  const shelfIncome = data.shelf
    .filter((r) => inPeriod(r.month))
    .reduce((s, r) => {
      const income = r.income ?? 0
      if (upToDay >= 31 || !r.month) return s + income
      const days = new Date(Number(r.month.slice(0, 4)), Number(r.month.slice(5, 7)), 0).getDate()
      return s + (income * Math.min(upToDay, days)) / days
    }, 0)

  const expenses = data.expenses
    .filter((e) => inPeriod(monthKey(e.date)) && byDay(e.date))
    .reduce((s, e) => s + e.amount, 0)

  return { revenue: orderRevenue + shelfIncome, expenses }
}

export interface Change {
  text: string
  /** Whether the change is good news — picks the colour. */
  good: boolean
  /** Longer explanation, for a tooltip. */
  title: string
}

/** "2026-09" → "Sep". */
function shortMonth(month: string): string {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  })
}

/**
 * This period against `month` (YYYY-MM). `toDate` says the earlier figure
 * covers only the same days of that month (the current month is still under
 * way). `upIsGood`: more revenue is good, more expenses isn't. There's nothing
 * to compare against a month with nothing in it.
 */
export function monthChange(
  current: number,
  previous: number,
  month: string,
  { toDate, upIsGood }: { toDate: boolean; upIsGood: boolean },
): Change | undefined {
  if (previous <= 0) return undefined
  const pct = Math.round(((current - previous) / previous) * 100)
  const short = shortMonth(month)
  const title = toDate ? `Compared with the same days of ${short}` : `Compared with all of ${short}`
  if (pct === 0) return { text: `same as ${short}`, good: true, title }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${short}`, good: pct > 0 === upIsGood, title }
}
