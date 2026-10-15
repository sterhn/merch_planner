// Numbers for the Insights page. Revenue follows the dashboard's rule exactly
// (paid orders in the month they were paid, plus historical shelf income), so
// the two screens never disagree.

import type { ExpenseFeedRow, Item, Order, OrderItem, ShelfItem } from './types'
import { currentMonth, localMonth, monthKey, monthRange } from './format'

export const INSIGHT_PERIODS = [
  { key: '3m', label: '3 months', months: 3 },
  { key: '12m', label: '12 months', months: 12 },
  { key: 'all', label: 'All time', months: null },
] as const

export type InsightPeriod = (typeof INSIGHT_PERIODS)[number]['key']

const MONTH_KEY = /^\d{4}-\d{2}$/

/** The month an order's money counts in: when it was paid, else when it was created. */
export function revenueMonth(o: Pick<Order, 'paid_at' | 'created_at'>): string {
  return localMonth(o.paid_at ?? o.created_at)
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Every month the period covers, oldest first, ending with `now`'s month. */
export function periodMonths(period: InsightPeriod, earliest: string, now: string = currentMonth()): string[] {
  const span = INSIGHT_PERIODS.find((p) => p.key === period)!.months
  const from = span === null ? (MONTH_KEY.test(earliest) && earliest < now ? earliest : now) : shiftMonth(now, -(span - 1))
  return monthRange(from, now)
}

/** Earliest month anything happened in — the start of "All time". */
export function earliestMonth(
  orders: readonly Pick<Order, 'paid_at' | 'created_at'>[],
  shelf: readonly Pick<ShelfItem, 'month'>[],
  expenses: readonly Pick<ExpenseFeedRow, 'date'>[],
): string {
  let earliest = currentMonth()
  const keys = [...orders.map(revenueMonth), ...shelf.map((s) => s.month ?? ''), ...expenses.map((e) => monthKey(e.date))]
  for (const k of keys) if (MONTH_KEY.test(k) && k < earliest) earliest = k
  return earliest
}

export interface MonthPoint {
  month: string
  revenue: number
  expenses: number
  net: number
}

export function monthlyTrend(
  orders: readonly Order[],
  shelf: readonly ShelfItem[],
  expenses: readonly ExpenseFeedRow[],
  months: readonly string[],
): MonthPoint[] {
  const points = new Map(months.map((m) => [m, { month: m, revenue: 0, expenses: 0, net: 0 }]))
  for (const o of orders) {
    if (!o.paid) continue
    const p = points.get(revenueMonth(o))
    if (p) p.revenue += o.total_price ?? 0
  }
  for (const s of shelf) {
    const p = points.get(s.month ?? '')
    if (p) p.revenue += s.income ?? 0
  }
  for (const e of expenses) {
    const p = points.get(monthKey(e.date))
    if (p) p.expenses += e.amount
  }
  for (const p of points.values()) p.net = p.revenue - p.expenses
  return [...points.values()]
}

export interface ItemSales {
  key: string
  name: string
  fandom: string | null
  units: number
  revenue: number
}

/** Units and revenue per item across the given (paid, in-period) orders' lines, best sellers first. */
export function itemSales(
  lines: readonly OrderItem[],
  orderIds: ReadonlySet<string>,
  catalog: ReadonlyMap<string, Pick<Item, 'name' | 'fandom'>>,
): ItemSales[] {
  const rows = new Map<string, ItemSales>()
  for (const l of lines) {
    if (!orderIds.has(l.order_id)) continue
    const item = l.item_id ? catalog.get(l.item_id) : undefined
    const key = l.item_id ?? `name:${(l.name_text ?? '').trim().toLowerCase()}`
    let row = rows.get(key)
    if (!row) {
      row = { key, name: item?.name ?? l.name_text ?? '—', fandom: item?.fandom?.trim() || null, units: 0, revenue: 0 }
      rows.set(key, row)
    }
    row.units += l.qty
    row.revenue += l.qty * (l.unit_price ?? 0)
  }
  return [...rows.values()].sort(
    (a, b) => b.units - a.units || b.revenue - a.revenue || a.name.localeCompare(b.name, 'ru'),
  )
}

export interface FandomSales {
  fandom: string | null
  units: number
  revenue: number
}

/** Item sales rolled up by fandom (custom lines and unfiled items under null), by revenue. */
export function fandomSales(sales: readonly ItemSales[]): FandomSales[] {
  const rows = new Map<string | null, FandomSales>()
  for (const s of sales) {
    const row = rows.get(s.fandom) ?? { fandom: s.fandom, units: 0, revenue: 0 }
    row.units += s.units
    row.revenue += s.revenue
    rows.set(s.fandom, row)
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units)
}

/** One customer however their contact was typed: "@Name", "name", "t.me/name" are the same person. */
export function customerKey(o: Pick<Order, 'telegram' | 'customer_email'>): string | null {
  const tg = (o.telegram ?? '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').toLowerCase()
  if (tg) return `tg:${tg}`
  const email = (o.customer_email ?? '').trim().toLowerCase()
  return email ? `email:${email}` : null
}

export interface CustomerStats {
  key: string
  label: string
  orders: number
  spend: number
  lastOrder: string
  lastOrderId: string
}

/** Paid orders grouped per customer, biggest spenders first. Orders with no contact are skipped. */
export function customerStats(orders: readonly Order[]): CustomerStats[] {
  const rows = new Map<string, CustomerStats>()
  for (const o of orders) {
    if (!o.paid) continue
    const key = customerKey(o)
    if (!key) continue
    const row = rows.get(key) ?? {
      key,
      label: o.telegram || o.customer_email || '',
      orders: 0,
      spend: 0,
      lastOrder: o.created_at,
      lastOrderId: o.id,
    }
    row.orders += 1
    row.spend += o.total_price ?? 0
    if (o.created_at > row.lastOrder) {
      row.lastOrder = o.created_at
      row.lastOrderId = o.id
    }
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.spend - a.spend || b.orders - a.orders)
}
