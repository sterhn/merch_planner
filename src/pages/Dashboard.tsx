import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { LayoutContext } from '../components/Layout'
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  HandCoins,
  LayoutDashboard,
  MoonStar,
  PackageCheck,
  PartyPopper,
  Search,
  Send,
  Sparkle,
  Sun,
  Sunrise,
  Sunset,
  Wallet,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { Collect, ExpenseFeedRow, Item, Order, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { useSettings } from '../hooks/useSettings'
import { backupDue } from '../lib/settings'
import { saveCatalogView } from '../lib/viewState'
import { monthChange, periodTotals } from '../lib/compare'
import EmptyState from '../components/EmptyState'
import { SkeletonDashboard } from '../components/Skeleton'
import {
  currentMonth,
  daysFromTodayISO,
  formatDate,
  formatMonth,
  formatRub,
  localMonth,
  monthKey,
  monthRange,
  localISODate,
  todayISO,
} from '../lib/format'
import { currentDayPart, daysBetween, dueLabel, GREETING, lateLabel, todayLabel, type DayPart } from '../lib/greeting'
import { haptic } from '../lib/haptics'
import AnimatedNumber from '../components/AnimatedNumber'
import Card from '../components/Card'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import StatTile from '../components/StatTile'
import { INSIGHTS, SECTIONS, SETTINGS } from '../components/sections'
import { TONE_BLOB, type Tone } from '../components/tones'

const MONTH_KEY = /^\d{4}-\d{2}$/

/** The timestamp that decides an order's revenue month. */
function paidMonthSource(o: Order): string {
  return o.paid_at ?? o.created_at
}

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

/** Unpaid this long, an order gets flagged as worth a nudge. */
const UNPAID_NUDGE_DAYS = 7

/** Search lives in the sidebar on desktop; mobile opens it from the dashboard header. */
function SearchButton() {
  const { openSearch } = useOutletContext<LayoutContext>()
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search everything"
      className="tap grid size-11 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink md:hidden"
    >
      <Search size={19} />
    </button>
  )
}

/** Settings (and sign-out) live in the sidebar on desktop; mobile reaches them here. */
function SettingsLink() {
  return (
    <Link
      to={SETTINGS.to}
      onClick={() => haptic(5)}
      aria-label="Settings"
      className="tap grid size-11 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink md:hidden"
    >
      <SETTINGS.icon size={19} />
    </Link>
  )
}

/** A collect date worth surfacing: a payment to make or a parcel to expect. */
interface CollectEvent {
  key: string
  collect: Collect
  kind: 'pay' | 'arrive'
  date: string
  days: number
  urgent: boolean
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

function ActionCard({ label, hint, count, to, tone, icon: Icon, index }: {
  label: string; hint?: string; count: number; to: string; tone: Tone; icon: LucideIcon; index: number
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
        {hint && <p className="truncate text-2xs font-bold text-bad">{hint}</p>}
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
  const [now] = useState(() => new Date())
  const { settings, isLoading: settingsLoading } = useSettings()

  // 'all' followed by every month from the earliest data point up to now,
  // so the stepper can walk back through history and land on the total.
  const periods = useMemo(() => {
    const keys = [
      ...(orders ?? []).map((o) => localMonth(paidMonthSource(o))),
      ...(expenses ?? []).map((e) => monthKey(e.date)),
      ...(shelf ?? []).map((r) => r.month ?? ''),
    ].filter((k) => MONTH_KEY.test(k))
    const current = currentMonth()
    let earliest = current
    for (const k of keys) if (k < earliest) earliest = k
    return ['all', ...monthRange(earliest, current)]
  }, [orders, expenses, shelf])

  const stats = useMemo(() => {
    const data = { orders: orders ?? [], shelf: shelf ?? [], expenses: expenses ?? [] }
    const { revenue, expenses: totalExpenses } = periodTotals(data, period)
    // The month before, for the "vs last month" lines — only when it has data.
    const prevPeriod = period === 'all' ? null : periods[periods.indexOf(period) - 1]
    // A month still under way is compared with the same days of the one before,
    // not all of it — otherwise every month looks down until its last week.
    const today = todayISO()
    const sameDays = period === today.slice(0, 7) ? Number(today.slice(8, 10)) : 31
    const previous =
      prevPeriod && prevPeriod !== 'all'
        ? { month: prevPeriod, toDate: sameDays < 31, ...periodTotals(data, prevPeriod, sameDays) }
        : null
    const unpaid = (orders ?? []).filter((o) => !o.paid)
    return {
      revenue,
      totalExpenses,
      net: revenue - totalExpenses,
      previous,
      unpaid: unpaid.length,
      unpaidStale: unpaid.filter((o) => daysBetween(localISODate(o.created_at), today) >= UNPAID_NUDGE_DAYS).length,
      toSend: (orders ?? []).filter((o) => o.paid && !o.sent).length,
    }
  }, [orders, shelf, expenses, period, periods])

  // Two dates per collect: pay by (deadline) and arrives by. Overdue payments
  // and late arrivals stay listed — those are the ones that need you most.
  const upcoming = useMemo(() => {
    const today = todayISO()
    const soon = daysFromTodayISO(7)
    const events: CollectEvent[] = []
    for (const c of collects ?? []) {
      // A collect that already arrived has nothing left to be due.
      if (c.received_at) continue
      if (!c.paid && c.deadline) {
        events.push({
          key: `${c.id}-pay`, collect: c, kind: 'pay', date: c.deadline,
          days: daysBetween(today, c.deadline), urgent: c.deadline <= soon,
        })
      }
      if (c.arrives_by) {
        events.push({
          key: `${c.id}-arrive`, collect: c, kind: 'arrive', date: c.arrives_by,
          days: daysBetween(today, c.arrives_by), urgent: c.arrives_by < today,
        })
      }
    }
    return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 4)
  }, [collects])

  // Bundles are excluded: their availability comes from component stock,
  // and the components themselves already surface here. Archived items are
  // retired on purpose, so their stock no longer matters.
  const threshold = settings.lowStockThreshold
  const lowStock = useMemo(() => {
    const bundleIds = new Set((rawBundles ?? []).map((b) => b.bundle_id))
    return (items ?? [])
      .filter((i) => !i.archived && !bundleIds.has(i.id) && i.stock_qty !== null && i.stock_qty <= threshold)
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0))
  }, [items, rawBundles, threshold])

  const showBackupNudge = !settingsLoading && backupDue(settings.lastBackupAt, now)

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
      <SearchButton />
      <SettingsLink />
    </PageHeader>
  )

  // Needs no data, so it's usable while the numbers are still loading.
  const quickAdd = (
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
  )

  if (isLoading || isError) {
    return (
      <div>
        {header}
        {quickAdd}
        {isError ? (
          <EmptyState
            icon={LayoutDashboard}
            tone="bad"
            message="Failed to load the dashboard."
            onRetry={() => queries.forEach((q) => void q.refetch())}
          />
        ) : (
          <SkeletonDashboard />
        )}
      </div>
    )
  }

  return (
    <div>
      {header}
      {quickAdd}

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1 font-display text-base">
          Overview
          {/* The sidebar links Insights on desktop; this is the mobile way in. */}
          <Link
            to={INSIGHTS.to}
            onClick={() => haptic(5)}
            className="tap flex min-h-11 items-center gap-1 rounded-full px-2 font-sans text-xs font-bold text-brand hover:bg-brand/10"
          >
            <INSIGHTS.icon size={14} />
            Insights
          </Link>
        </h2>
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
          <StatTile
            label="Revenue"
            value={stats.revenue}
            tone="good"
            icon={TrendingUp}
            format={formatRub}
            index={0}
            change={
              stats.previous
                ? monthChange(stats.revenue, stats.previous.revenue, stats.previous.month, {
                    toDate: stats.previous.toDate,
                    upIsGood: true,
                  })
                : undefined
            }
          />
          <StatTile
            label="Expenses"
            value={stats.totalExpenses}
            tone="bad"
            icon={TrendingDown}
            format={formatRub}
            index={1}
            change={
              stats.previous
                ? monthChange(stats.totalExpenses, stats.previous.expenses, stats.previous.month, {
                    toDate: stats.previous.toDate,
                    upIsGood: false,
                  })
                : undefined
            }
          />
        </div>
      </div>

      {hasActions && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {stats.unpaid > 0 && (
            <ActionCard
              label="unpaid orders"
              hint={stats.unpaidStale > 0 ? `${stats.unpaidStale} over a week` : undefined}
              count={stats.unpaid}
              to="/orders?filter=unpaid"
              tone="bad"
              icon={HandCoins}
              index={0}
            />
          )}
          {stats.toSend > 0 && (
            <ActionCard label="paid, not sent" count={stats.toSend} to="/orders?filter=to_send" tone="accent" icon={Send} index={1} />
          )}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {showBackupNudge && (
          <Link
            to={SETTINGS.to}
            className="lift flex animate-pop items-center gap-3 rounded-card glass p-3.5"
            style={{ animationDelay: '420ms' }}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB.brand}`} aria-hidden>
              <DownloadCloud size={19} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">Time for a backup</span>
              <span className="block truncate text-xs text-ink-muted">
                {settings.lastBackupAt ? `Last one ${formatDate(settings.lastBackupAt)}` : 'You haven’t saved one yet'} — tap to download
              </span>
            </span>
          </Link>
        )}
        {lowStock.length > 0 && (
          <Card
            title={
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={12} strokeWidth={2.6} className="text-bad" />
                Running low
              </span>
            }
            action={
              // Opens the live catalog sorted low-stock first, so the rest of
              // the list continues where this card stops.
              <Link
                to="/catalog"
                onClick={() =>
                  saveCatalogView({ sort: 'stock', search: '', type: null, fandom: null, archived: false })
                }
                className="tap -my-3 -mr-2 flex min-h-11 items-center px-2 text-xs font-bold text-brand"
              >
                {lowStock.length > 4 ? `All ${lowStock.length}` : 'Catalog'}
              </Link>
            }
            className="animate-pop"
            style={{ animationDelay: '480ms' }}
          >
            <div className="space-y-1.5">
              {lowStock.slice(0, 4).map((i) => (
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
            {/* Start a collect with these items as its positions. */}
            <Link
              to={`/collects?new=1&items=${lowStock.slice(0, 30).map((i) => i.id).join(',')}`}
              onClick={() => haptic(5)}
              className="tap mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-brand/40 text-sm font-bold text-brand hover:bg-brand/10"
            >
              <SECTIONS.collects.icon size={15} />
              Plan a reprint
            </Link>

          </Card>
        )}

        {recentOrders.length > 0 && (
          <Card
            title="Recent orders"
            action={
              <Link to="/orders" className="tap -my-3 -mr-2 flex min-h-11 items-center px-2 text-xs font-bold text-brand">
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
        <h2 className="mb-2 font-display text-base">Collect dates</h2>
        {upcoming.length === 0 ? (
          <Card className="animate-pop">
            <EmptyState icon={PartyPopper} tone="sun" message="All caught up!" hint="Nothing to pay for or wait on." />
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => {
              const KindIcon = e.kind === 'pay' ? Wallet : PackageCheck
              return (
                <Link
                  key={e.key}
                  to={`/collects?open=${e.collect.id}`}
                  className="lift flex items-center justify-between gap-3 rounded-card glass p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB.sky}`} aria-hidden>
                      <KindIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{e.collect.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {e.kind === 'pay' ? `Pay ${formatRub(e.collect.total_cost)}` : 'Arrives'}
                        {e.collect.vendor ? ` · ${e.collect.vendor}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        e.urgent ? 'bg-bad/10 text-bad' : 'bg-sun/40 text-ink'
                      }`}
                    >
                      <CalendarClock size={13} />
                      {e.days < 0 ? lateLabel(-e.days) : dueLabel(e.days)}
                    </span>
                    <span className="text-2xs text-ink-faint">{formatDate(e.date)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
