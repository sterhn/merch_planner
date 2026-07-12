import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Collect, ExpenseFeedRow, Item, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { currentMonth, formatDate, formatMonth, formatRub, monthKey, toISODate } from '../lib/format'
import { haptic } from '../lib/haptics'
import AnimatedNumber from '../components/AnimatedNumber'

const MONTH_KEY = /^\d{4}-\d{2}$/

function HeroCard({ value, isPositive }: { value: number; isPositive: boolean }) {
  return (
    <div className="animate-pop rounded-card bg-brand-strong p-5 shadow-card" style={{ animationDelay: '0ms' }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Net profit</p>
      <p className="mt-1 font-display text-3xl text-white">
        <AnimatedNumber value={value} format={formatRub} />
      </p>
      {!isPositive && (
        <span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
          deficit
        </span>
      )}
    </div>
  )
}

function MetricCard({ label, value, tone, index }: {
  label: string; value: number; tone?: 'success' | 'danger' | 'brand'; index: number
}) {
  const border = tone === 'success' ? 'border-l-good' : tone === 'danger' ? 'border-l-bad' : 'border-l-brand'
  const text = tone === 'success' ? 'text-good' : tone === 'danger' ? 'text-bad' : 'text-brand'
  return (
    <div
      className={`animate-pop rounded-card border-l-4 ${border} bg-surface p-3 shadow-card`}
      style={{ animationDelay: `${(index + 1) * 60}ms` }}
    >
      <p className={`font-display text-base leading-tight ${text}`}>
        <AnimatedNumber value={value} format={formatRub} />
      </p>
      <p className="mt-0.5 text-[11px] text-ink-faint">{label}</p>
    </div>
  )
}

function ActionCard({ label, count, to, tone, index }: {
  label: string; count: number; to: string; tone: 'danger' | 'brand'; index: number
}) {
  const badge = tone === 'danger' ? 'bg-bad text-white' : 'bg-brand text-white'
  return (
    <Link
      to={to}
      className="animate-pop tap flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-card hover:bg-surface-2"
      style={{ animationDelay: `${(index + 4) * 60}ms` }}
    >
      <span className={`shrink-0 rounded-xl px-3 py-1.5 font-display text-lg font-bold ${badge}`}>
        <AnimatedNumber value={count} />
      </span>
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { data: orders } = useList<Order>('orders')
  const { data: shelf } = useList<ShelfItem>('shelf_items')
  const { data: expenses } = useList<ExpenseFeedRow>('expense_feed')
  const { data: collects } = useList<Collect>('collects')
  const { data: items } = useList<Item>('items')
  const { data: rawBundles } = useList<{ bundle_id: string }>('bundle_items', { select: 'bundle_id' })

  const [period, setPeriod] = useState(currentMonth)

  // 'all' followed by every month from the earliest data point up to now,
  // so the stepper can walk back through history and land on the total.
  const periods = useMemo(() => {
    const keys = [
      ...(orders ?? []).map((o) => monthKey(o.created_at)),
      ...(expenses ?? []).map((e) => monthKey(e.date)),
      ...(shelf ?? []).map((r) => r.month ?? ''),
    ].filter((k) => MONTH_KEY.test(k))
    const current = currentMonth()
    let earliest = current
    for (const k of keys) if (k < earliest) earliest = k
    const list = ['all']
    let y = Number(earliest.slice(0, 4))
    let m = Number(earliest.slice(5, 7))
    const [cy, cm] = [Number(current.slice(0, 4)), Number(current.slice(5, 7))]
    while (y < cy || (y === cy && m <= cm)) {
      list.push(`${y}-${String(m).padStart(2, '0')}`)
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    return list
  }, [orders, expenses, shelf])

  const stats = useMemo(() => {
    const inPeriod = (m: string | null) => period === 'all' || m === period
    const orderRevenue = (orders ?? [])
      .filter((o) => o.paid && inPeriod(monthKey(o.created_at)))
      .reduce((s, o) => s + (o.total_price ?? 0), 0)
    const shelfIncome = (shelf ?? []).filter((r) => inPeriod(r.month)).reduce((s, r) => s + (r.income ?? 0), 0)
    const totalExpenses = (expenses ?? []).filter((e) => inPeriod(monthKey(e.date))).reduce((s, e) => s + e.amount, 0)
    return {
      orderRevenue,
      shelfIncome,
      totalExpenses,
      net: orderRevenue + shelfIncome - totalExpenses,
      unpaid: (orders ?? []).filter((o) => !o.paid).length,
      toSend: (orders ?? []).filter((o) => o.paid && !o.sent).length,
    }
  }, [orders, shelf, expenses, period])

  const upcoming = useMemo(() => {
    const now = new Date()
    const today = toISODate(now)
    const soon = toISODate(new Date(now.getTime() + 7 * 86400000))
    return (collects ?? [])
      .filter((c) => c.deadline != null && c.deadline >= today)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 3)
      .map((c) => ({ ...c, urgent: c.deadline! <= soon }))
  }, [collects])

  const topSeller = useMemo(
    () => [...(shelf ?? [])].sort((a, b) => (b.qty_sold ?? 0) - (a.qty_sold ?? 0)).find((r) => (r.qty_sold ?? 0) > 0) ?? null,
    [shelf],
  )

  // Bundles are excluded: their availability comes from component stock,
  // and the components themselves already surface here.
  const lowStock = useMemo(() => {
    const bundleIds = new Set((rawBundles ?? []).map((b) => b.bundle_id))
    return (items ?? [])
      .filter((i) => !bundleIds.has(i.id) && i.stock_qty !== null && i.stock_qty <= 2)
      .slice(0, 4)
  }, [items, rawBundles])

  const recentOrders = useMemo(() => (orders ?? []).slice(0, 3), [orders])

  const hasActions = stats.unpaid > 0 || stats.toSend > 0

  const periodIdx = periods.indexOf(period)
  const shiftPeriod = (delta: number) => {
    const next = periods[periodIdx + delta]
    if (next) {
      haptic()
      setPeriod(next)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl">Dashboard</h1>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            disabled={periodIdx <= 0}
            aria-label="Previous period"
            className="tap grid size-11 place-items-center text-ink-muted disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-24 text-center text-sm font-bold">
            {period === 'all' ? 'All time' : formatMonth(period)}
          </span>
          <button
            type="button"
            onClick={() => shiftPeriod(1)}
            disabled={periodIdx === periods.length - 1}
            aria-label="Next period"
            className="tap grid size-11 place-items-center text-ink-muted disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <HeroCard value={stats.net} isPositive={stats.net >= 0} />
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Revenue" value={stats.orderRevenue} tone="success" index={0} />
          <MetricCard label="Expenses" value={stats.totalExpenses} tone="danger" index={1} />
          <MetricCard label="Shelf" value={stats.shelfIncome} tone="brand" index={2} />
        </div>
      </div>

      {hasActions && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {stats.unpaid > 0 && <ActionCard label="unpaid orders" count={stats.unpaid} to="/orders?filter=unpaid" tone="danger" index={0} />}
          {stats.toSend > 0 && <ActionCard label="paid, not sent" count={stats.toSend} to="/orders?filter=to_send" tone="brand" index={1} />}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {topSeller && (
          <div className="animate-pop rounded-card bg-surface p-4 shadow-card" style={{ animationDelay: '420ms' }}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint">Top seller</p>
            <p className="truncate text-sm font-bold">{topSeller.name}</p>
            <p className="text-xs text-ink-muted">
              <span className="font-bold text-good">{topSeller.qty_sold} sold</span> · {formatRub(topSeller.income)}
            </p>
          </div>
        )}

        {lowStock.length > 0 && (
          <div className="animate-pop rounded-card bg-surface p-4 shadow-card" style={{ animationDelay: '480ms' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-faint">Low stock alert</p>
            <div className="space-y-1.5">
              {lowStock.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{i.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      (i.stock_qty ?? 0) === 0 ? 'bg-bad/10 text-bad' : 'bg-sun/30 text-ink'
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
          <div className="animate-pop rounded-card bg-surface p-4 shadow-card" style={{ animationDelay: '540ms' }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Recent orders</p>
              <Link to="/orders" className="text-xs font-bold text-brand">View all</Link>
            </div>
            <div className="divide-y divide-line">
              {recentOrders.map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="tap flex items-center justify-between py-2">
                  <p className="min-w-0 truncate text-sm">{o.telegram || o.customer_email || 'no contact'}</p>
                  <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-muted">Upcoming collect deadlines</h2>
        {upcoming.length === 0 ? (
          <div className="animate-pop rounded-card bg-surface p-8 text-center shadow-card">
            <p className="text-3xl leading-none">✧</p>
            <p className="mt-2 text-sm font-bold text-ink">All caught up!</p>
            <p className="text-xs text-ink-faint">No upcoming deadlines.</p>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  )
}
