import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Collect, ExpenseFeedRow, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'

function Card({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
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
      <h1 className="mb-4 text-xl font-bold">Dashboard</h1>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card label="Order revenue (paid)" value={formatRub(stats.orderRevenue)} tone="green" />
        <Card label="Shelf income" value={formatRub(stats.shelfIncome)} tone="green" />
        <Card label="Expenses" value={formatRub(stats.totalExpenses)} tone="red" />
        <Card label="Net" value={formatRub(stats.net)} tone={stats.net >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link to="/orders" className="rounded-xl bg-white p-4 shadow-sm hover:bg-violet-50">
          <p className="text-lg font-bold">{stats.unpaid}</p>
          <p className="text-xs text-gray-500">unpaid orders</p>
        </Link>
        <Link to="/orders" className="rounded-xl bg-white p-4 shadow-sm hover:bg-violet-50">
          <p className="text-lg font-bold">{stats.toSend}</p>
          <p className="text-xs text-gray-500">paid, not sent</p>
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Upcoming collect deadlines</h2>
        {upcoming.length === 0 && <p className="text-sm text-gray-400">No upcoming deadlines.</p>}
        <div className="space-y-2">
          {upcoming.map((c) => (
            <Link key={c.id} to="/collects" className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm hover:bg-violet-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-gray-500">{c.vendor}</p>
              </div>
              <span className="shrink-0 text-sm text-gray-600">{formatDate(c.deadline)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
