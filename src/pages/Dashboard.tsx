import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, LayoutDashboard, Loader2, LogOut } from 'lucide-react'
import type { Collect, ExpenseFeedRow, Item, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { useSignOut } from '../hooks/useAuth'
import EmptyState from '../components/EmptyState'
import {
  currentMonth,
  daysFromTodayISO,
  formatDate,
  formatMonth,
  formatRub,
  localMonth,
  monthKey,
  monthRange,
  todayISO,
} from '../lib/format'
import { haptic } from '../lib/haptics'
import AnimatedNumber from '../components/AnimatedNumber'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import StatTile from '../components/StatTile'

const MONTH_KEY = /^\d{4}-\d{2}$/

/** The sidebar sign-out is desktop-only, so mobile needs one here. */
function SignOutButton() {
  const signOut = useSignOut()
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        void signOut()
      }}
      aria-label="Sign out"
      className="tap grid size-11 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink md:hidden"
    >
      <LogOut size={18} />
    </button>
  )
}

function HeroCard({ value, isPositive }: { value: number; isPositive: boolean }) {
  return (
    <div className="animate-pop rounded-card bg-brand-strong p-5 shadow-card" style={{ animationDelay: '0ms' }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-on-brand-strong/60">Net profit</p>
      <p className="mt-1 font-display text-3xl text-on-brand-strong">
        <AnimatedNumber value={value} format={formatRub} />
      </p>
      {!isPositive && (
        <span className="mt-2 inline-block rounded-full bg-on-brand-strong/20 px-2.5 py-0.5 text-xs font-semibold text-on-brand-strong">
          deficit
        </span>
      )}
    </div>
  )
}

function ActionCard({ label, count, to, tone, index }: {
  label: string; count: number; to: string; tone: 'danger' | 'brand'; index: number
}) {
  const badge = tone === 'danger' ? 'bg-bad text-on-bad' : 'bg-brand text-on-brand'
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
  const ordersQ = useList<Order>('orders', { orderBy: 'created_at', ascending: false })
  const shelfQ = useList<ShelfItem>('shelf_items')
  const expensesQ = useList<ExpenseFeedRow>('expense_feed')
  const collectsQ = useList<Collect>('collects')
  const itemsQ = useList<Item>('items')
  const bundlesQ = useList<{ bundle_id: string }>('bundle_items', { select: 'bundle_id' })

  const { data: orders } = ordersQ
  const { data: shelf } = shelfQ
  const { data: expenses } = expensesQ
  const { data: collects } = collectsQ
  const { data: items } = itemsQ
  const { data: rawBundles } = bundlesQ

  // Every tile here is a sum. Rendering them before the rows land would animate an
  // authoritative-looking 0 ₽ that reads as "you earned nothing" rather than
  // "not loaded yet" — so the whole page waits on the set.
  const queries = [ordersQ, shelfQ, expensesQ, collectsQ, itemsQ, bundlesQ]
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  const [period, setPeriod] = useState(currentMonth)

  // 'all' followed by every month from the earliest data point up to now,
  // so the stepper can walk back through history and land on the total.
  const periods = useMemo(() => {
    const keys = [
      ...(orders ?? []).map((o) => localMonth(o.created_at)),
      ...(expenses ?? []).map((e) => monthKey(e.date)),
      ...(shelf ?? []).map((r) => r.month ?? ''),
    ].filter((k) => MONTH_KEY.test(k))
    const current = currentMonth()
    let earliest = current
    for (const k of keys) if (k < earliest) earliest = k
    return ['all', ...monthRange(earliest, current)]
  }, [orders, expenses, shelf])

  const stats = useMemo(() => {
    const inPeriod = (m: string | null) => period === 'all' || m === period
    const orderRevenue = (orders ?? [])
      .filter((o) => o.paid && inPeriod(localMonth(o.created_at)))
      .reduce((s, o) => s + (o.total_price ?? 0), 0)
    // The shelf page is archived, but its historical income still counts —
    // folded into Revenue so past months (and the all-time net) stay truthful.
    const shelfIncome = (shelf ?? []).filter((r) => inPeriod(r.month)).reduce((s, r) => s + (r.income ?? 0), 0)
    const totalExpenses = (expenses ?? []).filter((e) => inPeriod(monthKey(e.date))).reduce((s, e) => s + e.amount, 0)
    const revenue = orderRevenue + shelfIncome
    return {
      revenue,
      totalExpenses,
      net: revenue - totalExpenses,
      unpaid: (orders ?? []).filter((o) => !o.paid).length,
      toSend: (orders ?? []).filter((o) => o.paid && !o.sent).length,
    }
  }, [orders, shelf, expenses, period])

  const upcoming = useMemo(() => {
    const today = todayISO()
    const soon = daysFromTodayISO(7)
    return (collects ?? [])
      .filter((c) => c.deadline != null && c.deadline >= today)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 3)
      .map((c) => ({ ...c, urgent: c.deadline! <= soon }))
  }, [collects])

  // Bundles are excluded: their availability comes from component stock,
  // and the components themselves already surface here.
  const lowStock = useMemo(() => {
    const bundleIds = new Set((rawBundles ?? []).map((b) => b.bundle_id))
    return (items ?? [])
      .filter((i) => !bundleIds.has(i.id) && i.stock_qty !== null && i.stock_qty <= 2)
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0))
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

  if (isLoading || isError) {
    return (
      <div>
        <PageHeader title="Dashboard">
          <SignOutButton />
        </PageHeader>
        {isError ? (
          <EmptyState
            icon={LayoutDashboard}
            message="Failed to load the dashboard."
            onRetry={() => queries.forEach((q) => void q.refetch())}
          />
        ) : (
          <EmptyState icon={Loader2} spin message="Loading…" />
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard">
        <div className="flex items-center">
          <SignOutButton />
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
      </PageHeader>

      <div className="mb-3 flex flex-col gap-2">
        <HeroCard value={stats.net} isPositive={stats.net >= 0} />
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Revenue" value={stats.revenue} tone="good" format={formatRub} index={0} />
          <StatTile label="Expenses" value={stats.totalExpenses} tone="bad" format={formatRub} index={1} />
        </div>
      </div>

      {hasActions && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {stats.unpaid > 0 && <ActionCard label="unpaid orders" count={stats.unpaid} to="/orders?filter=unpaid" tone="danger" index={0} />}
          {stats.toSend > 0 && <ActionCard label="paid, not sent" count={stats.toSend} to="/orders?filter=to_send" tone="brand" index={1} />}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {lowStock.length > 0 && (
          <Card title="Low stock alert" className="animate-pop" style={{ animationDelay: '480ms' }}>
            <div className="space-y-1.5">
              {lowStock.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{i.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      (i.stock_qty ?? 0) <= 0 ? 'bg-bad/10 text-bad' : 'bg-sun/30 text-ink'
                    }`}
                  >
                    {i.stock_qty} left
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {recentOrders.length > 0 && (
          <Card
            title="Recent orders"
            action={
              <Link to="/orders" className="text-xs font-bold text-brand">
                View all
              </Link>
            }
            className="animate-pop"
            style={{ animationDelay: '540ms' }}
          >
            <div className="divide-y divide-line">
              {recentOrders.map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="tap flex items-center justify-between py-2">
                  <p className="min-w-0 truncate text-sm">{o.telegram || o.customer_email || 'no contact'}</p>
                  <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-muted">Upcoming collect deadlines</h2>
        {upcoming.length === 0 ? (
          <Card className="animate-pop">
            <EmptyState icon={CalendarCheck} message="All caught up!" hint="No upcoming deadlines." />
          </Card>
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
                    c.urgent ? 'bg-bad/10 text-bad' : 'bg-sun/30 text-ink'
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
