import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Collect, ExpenseFeedRow, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'

function Card({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
  const border = tone === 'green' ? 'border-l-4 border-emerald-500' : tone === 'red' ? 'border-l-4 border-red-400' : 'border-l-4 border-violet-400'
  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${border}`}>
      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`text-lg font-bold tracking-tight ${color}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: orders } = useList<Order>('orders')
  const { data: shelf } = useList<ShelfItem>('shelf_items')
  const { data: expenses } = useList<ExpenseFeedRow>('expense_feed')
  const { data: collects } = useList<Collect>('collects')

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

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold tracking-tight">Dashboard</h1>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card label="Order revenue (paid)" value={formatRub(stats.orderRevenue)} tone="green" />
        <Card label="Shelf income" value={formatRub(stats.shelfIncome)} tone="green" />
        <Card label="Expenses" value={formatRub(stats.totalExpenses)} tone="red" />
        <Card label="Net" value={formatRub(stats.net)} tone={stats.net >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link to="/orders" className="rounded-xl bg-white p-4 shadow-sm transition-shadow duration-150 hover:bg-violet-50 hover:shadow-md">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-widest text-gray-400">Unpaid orders</p>
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-bold tracking-tight">{stats.unpaid}</p>
            <span className="text-gray-300">→</span>
          </div>
        </Link>
        <Link to="/orders" className="rounded-xl bg-white p-4 shadow-sm transition-shadow duration-150 hover:bg-violet-50 hover:shadow-md">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-widest text-gray-400">Paid, not sent</p>
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-bold tracking-tight">{stats.toSend}</p>
            <span className="text-gray-300">→</span>
          </div>
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">📅 Upcoming deadlines</h2>
        {upcoming.length === 0 && <p className="text-sm text-gray-400">No upcoming deadlines.</p>}
        <div className="space-y-2">
          {upcoming.map((c) => {
            const daysUntil = Math.ceil((new Date(c.deadline!).getTime() - Date.now()) / 86400000)
            const dateColor = daysUntil <= 7 ? 'text-red-500 font-semibold' : 'text-gray-500'
            return (
              <Link key={c.id} to="/collects" className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm transition-shadow duration-150 hover:bg-violet-50 hover:shadow-md">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.vendor}</p>
                </div>
                <span className={`shrink-0 text-sm ${dateColor}`}>{formatDate(c.deadline)}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
