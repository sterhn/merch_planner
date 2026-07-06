import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Collect, ExpenseFeedRow, Item, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'

function HeroCard({ value, isPositive }: { value: string; isPositive: boolean }) {
  return (
    <div className="rounded-2xl bg-violet-700 p-5 shadow-md">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Net profit</p>
      <p className="mt-1 text-4xl font-bold text-white">{value}</p>
      {!isPositive && (
        <span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
          deficit
        </span>
      )}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | 'brand' }) {
  const border = tone === 'success' ? 'border-l-emerald-500' : tone === 'danger' ? 'border-l-red-500' : 'border-l-violet-500'
  const text = tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-red-600' : 'text-violet-700'
  return (
    <div className={`rounded-xl border-l-4 ${border} bg-white p-3 shadow-sm`}>
      <p className={`text-lg font-bold leading-tight ${text}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{label}</p>
    </div>
  )
}

function ActionCard({ label, count, to, tone }: { label: string; count: number; to: string; tone: 'danger' | 'brand' }) {
  const badge = tone === 'danger' ? 'bg-red-500 text-white' : 'bg-violet-600 text-white'
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm hover:bg-violet-50">
      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-lg font-bold ${badge}`}>{count}</span>
      <p className="text-sm text-gray-700">{label}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { data: orders } = useList<Order>('orders')
  const { data: shelf } = useList<ShelfItem>('shelf_items')
  const { data: expenses } = useList<ExpenseFeedRow>('expense_feed')
  const { data: collects } = useList<Collect>('collects')
  const { data: items } = useList<Item>('items')

  const stats = useMemo(() => {
    const orderRevenue = (orders ?? []).filter((o) => o.paid).reduce((s, o) => s + (o.total_price ?? 0), 0)
    const shelfIncome = (shelf ?? []).reduce((s, r) => s + (r.income ?? 0), 0)
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0)
    return {
      orderRevenue,
      shelfIncome,
      totalExpenses,
      net: orderRevenue + shelfIncome - totalExpenses,
      unpaid: (orders ?? []).filter((o) => !o.paid).length,
      toSend: (orders ?? []).filter((o) => o.paid && !o.sent).length,
    }
  }, [orders, shelf, expenses])

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (collects ?? [])
      .filter((c) => c.deadline != null && c.deadline >= today)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 3)
  }, [collects])

  const topSeller = useMemo(
    () => [...(shelf ?? [])].sort((a, b) => (b.qty_sold ?? 0) - (a.qty_sold ?? 0)).find((r) => (r.qty_sold ?? 0) > 0) ?? null,
    [shelf],
  )

  const lowStock = useMemo(
    () => (items ?? []).filter((i) => i.stock_qty !== null && i.stock_qty <= 2).slice(0, 4),
    [items],
  )

  const recentOrders = useMemo(() => (orders ?? []).slice(0, 3), [orders])

  const hasActions = stats.unpaid > 0 || stats.toSend > 0

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Dashboard</h1>

      <div className="mb-3 flex flex-col gap-2">
        <HeroCard value={formatRub(stats.net)} isPositive={stats.net >= 0} />
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Revenue" value={formatRub(stats.orderRevenue)} tone="success" />
          <MetricCard label="Expenses" value={formatRub(stats.totalExpenses)} tone="danger" />
          <MetricCard label="Shelf" value={formatRub(stats.shelfIncome)} tone="brand" />
        </div>
      </div>

      {hasActions && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {stats.unpaid > 0 && <ActionCard label="unpaid orders" count={stats.unpaid} to="/orders" tone="danger" />}
          {stats.toSend > 0 && <ActionCard label="paid, not sent" count={stats.toSend} to="/orders" tone="brand" />}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {topSeller && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Top seller</p>
            <p className="truncate text-sm font-semibold">{topSeller.name}</p>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-emerald-600">{topSeller.qty_sold} sold</span> · {formatRub(topSeller.income)}
            </p>
          </div>
        )}

        {lowStock.length > 0 && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Low stock alert</p>
            <div className="space-y-1.5">
              {lowStock.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{i.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      (i.stock_qty ?? 0) === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {i.stock_qty} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentOrders.length > 0 && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Recent orders</p>
              <Link to="/orders" className="text-xs font-semibold text-violet-600">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentOrders.map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between py-1.5">
                  <p className="min-w-0 truncate text-sm">{o.telegram || o.customer_email || 'no contact'}</p>
                  <span className="shrink-0 text-sm font-semibold">{formatRub(o.total_price)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Upcoming collect deadlines</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-3xl leading-none">✧</p>
            <p className="mt-2 text-sm font-semibold text-gray-700">All caught up!</p>
            <p className="text-xs text-gray-400">No upcoming deadlines.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((c) => (
              <Link
                key={c.id}
                to="/collects"
                className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm hover:bg-violet-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.vendor}</p>
                </div>
                <span className="shrink-0 text-sm text-gray-600">{formatDate(c.deadline)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
