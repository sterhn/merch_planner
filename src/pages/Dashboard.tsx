import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Store,
  Wallet,
  Sparkles,
  ChevronRight,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'
import type { Collect, ExpenseFeedRow, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import AnimatedNumber from '../components/AnimatedNumber'

function StatTile({
  label,
  value,
  gradient,
  icon: Icon,
  index,
}: {
  label: string
  value: number
  gradient: string
  icon: LucideIcon
  index: number
}) {
  return (
    <div
      className={`animate-pop rounded-card bg-gradient-to-br p-4 text-white shadow-card ${gradient}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 whitespace-nowrap font-display text-lg leading-tight">
          <AnimatedNumber value={value} format={formatRub} />
        </p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon size={15} />
        </span>
      </div>
      <p className="text-xs font-semibold text-white/80">{label}</p>
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
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const soon = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    return (collects ?? [])
      .filter((c) => c.deadline != null && c.deadline >= today)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 3)
      .map((c) => ({ ...c, urgent: c.deadline! <= soon }))
  }, [collects])

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl">Dashboard</h1>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile
          index={0}
          label="Order revenue (paid)"
          value={stats.orderRevenue}
          gradient="from-emerald-500 to-teal-500"
          icon={TrendingUp}
        />
        <StatTile
          index={1}
          label="Shelf income"
          value={stats.shelfIncome}
          gradient="from-sky-500 to-indigo-500"
          icon={Store}
        />
        <StatTile
          index={2}
          label="Expenses"
          value={stats.totalExpenses}
          gradient="from-rose-500 to-orange-400"
          icon={Wallet}
        />
        <StatTile
          index={3}
          label="Net"
          value={stats.net}
          gradient={stats.net >= 0 ? 'from-violet-600 to-fuchsia-500' : 'from-rose-500 to-orange-400'}
          icon={Sparkles}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link
          to="/orders"
          className="tap animate-pop rounded-card bg-surface p-4 shadow-card"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-2xl text-brand">
              <AnimatedNumber value={stats.unpaid} />
            </p>
            <ChevronRight size={18} className="text-ink-faint" />
          </div>
          <p className="text-xs font-semibold text-ink-muted">unpaid orders</p>
        </Link>
        <Link
          to="/orders"
          className="tap animate-pop rounded-card bg-surface p-4 shadow-card"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-2xl text-brand">
              <AnimatedNumber value={stats.toSend} />
            </p>
            <ChevronRight size={18} className="text-ink-faint" />
          </div>
          <p className="text-xs font-semibold text-ink-muted">paid, not sent</p>
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-muted">Upcoming collect deadlines</h2>
        {upcoming.length === 0 && <p className="text-sm text-ink-faint">No upcoming deadlines.</p>}
        <div className="space-y-2">
          {upcoming.map((c) => (
            <Link
              key={c.id}
              to="/collects"
              className="tap flex items-center justify-between gap-3 rounded-card bg-surface p-3.5 shadow-card"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{c.name}</p>
                <p className="text-xs text-ink-muted">{c.vendor}</p>
              </div>
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  c.urgent ? 'bg-bad/10 text-bad' : 'bg-sun/20 text-ink'
                }`}
              >
                <CalendarClock size={13} />
                {formatDate(c.deadline)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
