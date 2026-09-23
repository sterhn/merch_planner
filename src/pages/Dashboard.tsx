import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  LayoutDashboard,
  LogOut,
  MoonStar,
  PartyPopper,
  Send,
  Sparkle,
  Sun,
  Sunrise,
  Sunset,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { Collect, ExpenseFeedRow, Item, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { useSignOut } from '../hooks/useAuth'
import EmptyState from '../components/EmptyState'
import LoadingDots from '../components/LoadingDots'
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
import { currentDayPart, daysBetween, dueLabel, GREETING, todayLabel, type DayPart } from '../lib/greeting'
import { haptic } from '../lib/haptics'
import AnimatedNumber from '../components/AnimatedNumber'
import Card from '../components/Card'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import StatTile from '../components/StatTile'
import { SECTIONS } from '../components/sections'
import { TONE_BLOB, type Tone } from '../components/tones'

const MONTH_KEY = /^\d{4}-\d{2}$/

const DAY_ICON: Record<DayPart, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: MoonStar,
}

const DAY_TONE: Record<DayPart, Tone> = {
  morning: 'sun',
  afternoon: 'peach',
  evening: 'accent',
  night: 'brand',
}

/** One-tap shortcuts into each page's "add" sheet (see useLaunchFlag). */
const QUICK_ACTIONS = [
  { ...SECTIONS.orders, to: '/orders?new=1', label: 'Order' },
  { ...SECTIONS.catalog, to: '/catalog?new=1', label: 'Item' },
  { ...SECTIONS.collects, to: '/collects?new=1', label: 'Collect' },
  { ...SECTIONS.expenses, to: '/expenses?new=1', label: 'Expense' },
]

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

function HeroCard({ value, revenue }: { value: number; revenue: number }) {
  const margin = revenue > 0 ? Math.round((value / revenue) * 100) : null
  return (
    <div
      className="relative animate-pop overflow-hidden rounded-card bg-linear-to-br from-brand-strong to-brand-strong-2 p-5 shadow-card inset-shadow-[0_1px_0_var(--glass-gloss)]"
      style={{ animationDelay: '0ms' }}
    >
      {/* Decorative sparkles and a soft glow blob */}
      <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-on-brand-strong/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 right-16 size-32 rounded-full bg-on-brand-strong/5" aria-hidden />
      <Sparkle size={18} className="absolute right-6 top-5 animate-twinkle fill-current text-on-brand-strong/70" aria-hidden />
      <Sparkle
        size={11}
        className="absolute right-14 top-12 animate-twinkle fill-current text-on-brand-strong/50"
        style={{ animationDelay: '1.1s' }}
        aria-hidden
      />
      <p className="relative text-xs font-bold uppercase tracking-widest text-on-brand-strong/70">Net profit</p>
      <p className="relative mt-1 font-display text-4xl text-on-brand-strong">
        <AnimatedNumber value={value} format={formatRub} />
      </p>
      <div className="relative mt-2 flex flex-wrap gap-1.5">
        {value < 0 && (
          <span className="rounded-full bg-on-brand-strong/20 px-2.5 py-0.5 text-xs font-bold text-on-brand-strong">
            deficit
          </span>
        )}
        {margin !== null && (
          <span className="rounded-full bg-on-brand-strong/15 px-2.5 py-0.5 text-xs font-bold text-on-brand-strong">
            {margin}% margin
          </span>
        )}
      </div>
    </div>
  )
}

function ActionCard({ label, count, to, tone, icon: Icon, index }: {
  label: string; count: number; to: string; tone: Tone; icon: LucideIcon; index: number
}) {
  return (
    <Link
      to={to}
      className="lift flex animate-pop items-center gap-3 rounded-card glass p-3.5"
      style={{ animationDelay: `${(index + 4) * 60}ms` }}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB[tone]}`} aria-hidden>
        <Icon size={19} strokeWidth={2.3} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight">
          <AnimatedNumber value={count} />
        </p>
        <p className="truncate text-2xs font-semibold text-ink-faint">{label}</p>
      </div>
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
  const [part] = useState(currentDayPart)
  const [dateLabel] = useState(todayLabel)

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
      // A collect that already arrived has nothing left to be due.
      .filter((c) => !c.received_at && c.deadline != null && c.deadline >= today)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 3)
      .map((c) => ({ ...c, urgent: c.deadline! <= soon, days: daysBetween(today, c.deadline!) }))
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

  const header = (
    <PageHeader
      title={`${GREETING[part]}!`}
      subtitle={dateLabel}
      icon={DAY_ICON[part]}
      tone={DAY_TONE[part]}
    >
      <SignOutButton />
    </PageHeader>
  )

  if (isLoading || isError) {
    return (
      <div>
        {header}
        {isError ? (
          <EmptyState
            icon={LayoutDashboard}
            tone="bad"
            message="Failed to load the dashboard."
            onRetry={() => queries.forEach((q) => void q.refetch())}
          />
        ) : (
          <LoadingDots />
        )}
      </div>
    )
  }

  return (
    <div>
      {header}

      <nav aria-label="Quick add" className="mb-4 grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((a, i) => (
          <Link
            key={a.to}
            to={a.to}
            onClick={() => haptic(5)}
            aria-label={`Add ${a.label.toLowerCase()}`}
            className="group lift flex animate-pop flex-col items-center gap-1.5 rounded-card glass px-1 py-3 md:flex-row md:justify-center md:gap-2.5 md:py-2.5"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className={`grid size-10 place-items-center rounded-[38%] ${TONE_BLOB[a.tone]}`} aria-hidden>
              <a.icon size={19} strokeWidth={2.3} className="group-hover:animate-wiggle" />
            </span>
            <span className="text-2xs font-bold text-ink-muted md:text-sm">+ {a.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base">Overview</h2>
        <div className="flex items-center rounded-full glass">
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            disabled={periodIdx <= 0}
            aria-label="Previous period"
            className="tap grid size-11 place-items-center text-ink-muted disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span key={period} className="min-w-24 animate-fade-in text-center text-sm font-bold">
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
        <HeroCard value={stats.net} revenue={stats.revenue} />
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Revenue" value={stats.revenue} tone="good" icon={TrendingUp} format={formatRub} index={0} />
          <StatTile label="Expenses" value={stats.totalExpenses} tone="bad" icon={TrendingDown} format={formatRub} index={1} />
        </div>
      </div>

      {hasActions && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {stats.unpaid > 0 && (
            <ActionCard label="unpaid orders" count={stats.unpaid} to="/orders?filter=unpaid" tone="bad" icon={HandCoins} index={0} />
          )}
          {stats.toSend > 0 && (
            <ActionCard label="paid, not sent" count={stats.toSend} to="/orders?filter=to_send" tone="accent" icon={Send} index={1} />
          )}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {lowStock.length > 0 && (
          <Card
            title={
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={12} strokeWidth={2.6} className="text-bad" />
                Running low
              </span>
            }
            action={
              <Link to="/catalog" className="text-xs font-bold text-brand">
                Catalog
              </Link>
            }
            className="animate-pop"
            style={{ animationDelay: '480ms' }}
          >
            <div className="space-y-1.5">
              {lowStock.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {i.image_url ? (
                      <img src={i.image_url} alt="" className="size-7 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${TONE_BLOB.good}`} aria-hidden>
                        <SECTIONS.catalog.icon size={14} />
                      </span>
                    )}
                    <p className="min-w-0 truncate text-sm">{i.name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      (i.stock_qty ?? 0) <= 0 ? 'bg-bad/10 text-bad' : 'bg-sun/40 text-ink'
                    }`}
                  >
                    {(i.stock_qty ?? 0) <= 0 ? 'sold out' : `${i.stock_qty} left`}
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
                <Link key={o.id} to={`/orders/${o.id}`} className="tap flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.telegram || o.customer_email || 'no contact'}</p>
                    <div className="mt-1">
                      <OrderStatus paid={o.paid} sent={o.sent} delivered={o.delivered} />
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-display text-base">Upcoming deadlines</h2>
        {upcoming.length === 0 ? (
          <Card className="animate-pop">
            <EmptyState icon={PartyPopper} tone="sun" message="All caught up!" hint="No collect deadlines coming up." />
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((c) => (
              <Link
                key={c.id}
                to="/collects"
                className="lift flex items-center justify-between gap-3 rounded-card glass p-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB.sky}`} aria-hidden>
                    <SECTIONS.collects.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="truncate text-xs text-ink-muted">{c.vendor}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      c.urgent ? 'bg-bad/10 text-bad' : 'bg-sun/40 text-ink'
                    }`}
                  >
                    <CalendarClock size={13} />
                    {dueLabel(c.days)}
                  </span>
                  <span className="text-2xs text-ink-faint">{formatDate(c.deadline)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
