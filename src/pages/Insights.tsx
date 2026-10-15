import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Repeat, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react'
import type { ExpenseFeedRow, Item, Order, OrderItem, ShelfItem } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import {
  customerStats,
  earliestMonth,
  fandomSales,
  INSIGHT_PERIODS,
  itemSales,
  monthlyTrend,
  periodMonths,
  revenueMonth,
  type InsightPeriod,
} from '../lib/insights'
import { NO_FANDOM_LABEL } from '../lib/orderLines'
import BarList from '../components/BarList'
import Card from '../components/Card'
import FilterChip from '../components/FilterChip'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import StatTile from '../components/StatTile'
import TrendChart from '../components/TrendChart'
import { INSIGHTS } from '../components/sections'

const TOP_N = 8
const CUSTOMERS_N = 10

const percent = (n: number) => `${Math.round(n)}%`
const pcs = (n: number) => `${n} pc${n === 1 ? '' : 's'}`
const wholeRub = (n: number) => formatRub(Math.round(n))

/**
 * How the shop is doing over a period: headline numbers, the monthly trend,
 * what sells, which fandoms carry it, and who buys. The period chips scope
 * everything on the page, so the numbers always agree with each other.
 */
export default function Insights() {
  const ordersQ = useList<Order>('orders')
  const linesQ = useList<OrderItem>('order_items')
  const itemsQ = useList<Item>('items')
  const shelfQ = useList<ShelfItem>('shelf_items')
  const expensesQ = useList<ExpenseFeedRow>('expense_feed')
  const queries = [ordersQ, linesQ, itemsQ, shelfQ, expensesQ]

  const [period, setPeriod] = useState<InsightPeriod>('12m')
  const [allCustomers, setAllCustomers] = useState(false)

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data])

  const months = useMemo(
    () => periodMonths(period, earliestMonth(orders, shelfQ.data ?? [], expensesQ.data ?? [])),
    [period, orders, shelfQ.data, expensesQ.data],
  )
  const trend = useMemo(
    () => monthlyTrend(orders, shelfQ.data ?? [], expensesQ.data ?? [], months),
    [orders, shelfQ.data, expensesQ.data, months],
  )

  // Paid orders whose money landed inside the period.
  const periodOrders = useMemo(() => {
    const inPeriod = new Set(months)
    return orders.filter((o) => o.paid && inPeriod.has(revenueMonth(o)))
  }, [orders, months])

  const catalog = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of itemsQ.data ?? []) m.set(i.id, i)
    return m
  }, [itemsQ.data])

  const sales = useMemo(
    () => itemSales(linesQ.data ?? [], new Set(periodOrders.map((o) => o.id)), catalog),
    [linesQ.data, periodOrders, catalog],
  )
  const fandoms = useMemo(() => fandomSales(sales), [sales])
  const customers = useMemo(() => customerStats(periodOrders), [periodOrders])

  const revenue = trend.reduce((s, p) => s + p.revenue, 0)
  const net = trend.reduce((s, p) => s + p.net, 0)
  const orderRevenue = periodOrders.reduce((s, o) => s + (o.total_price ?? 0), 0)
  const avgOrder = periodOrders.length > 0 ? orderRevenue / periodOrders.length : 0
  const repeatShare = customers.length > 0 ? (customers.filter((c) => c.orders > 1).length / customers.length) * 100 : 0

  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  return (
    <div>
      <PageHeader title="Insights" icon={INSIGHTS.icon} tone={INSIGHTS.tone} />

      {/* One filter row above everything it scopes. */}
      <div className="mb-4 flex gap-2 overflow-x-auto" role="group" aria-label="Period">
        {INSIGHT_PERIODS.map((p) => (
          <FilterChip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </FilterChip>
        ))}
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={false}
        icon={INSIGHTS.icon}
        errorMessage="Failed to load insights."
        emptyMessage=""
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />

      {!isLoading && !isError && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <StatTile label="Revenue" value={revenue} tone="good" icon={TrendingUp} format={formatRub} index={0} />
            <StatTile
              label="Net profit"
              value={net}
              tone={net < 0 ? 'bad' : 'brand'}
              icon={net < 0 ? TrendingDown : Coins}
              format={formatRub}
              index={1}
            />
            <StatTile label="Paid orders" value={periodOrders.length} icon={ShoppingCart} index={2} />
            <StatTile label="Average order" value={avgOrder} icon={Coins} format={wholeRub} index={3} />
            <StatTile label="Customers who came back" value={repeatShare} icon={Repeat} format={percent} index={4} />
          </div>

          <Card title="Revenue & net profit by month" className="animate-pop">
            <TrendChart
              title={`Line chart of revenue and net profit per month, ${months.length} months`}
              months={months}
              series={[
                { key: 'revenue', label: 'Revenue', color: 'var(--color-chart-1)', values: trend.map((p) => p.revenue) },
                { key: 'net', label: 'Net profit', color: 'var(--color-chart-2)', values: trend.map((p) => p.net) },
              ]}
            />
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Top sellers" className="animate-pop">
              <BarList
                empty="No paid orders in this period."
                rows={sales.slice(0, TOP_N).map((s) => ({
                  key: s.key,
                  label: s.name,
                  value: s.units,
                  display: (
                    <>
                      <span className="font-bold text-ink">{pcs(s.units)}</span> · {formatRub(s.revenue)}
                    </>
                  ),
                  title: `${s.name}: ${s.units} sold, ${formatRub(s.revenue)}`,
                }))}
              />
            </Card>

            <Card title="Best fandoms" className="animate-pop">
              <BarList
                empty="No paid orders in this period."
                rows={fandoms.slice(0, TOP_N).map((f) => ({
                  key: f.fandom ?? '__none__',
                  label: f.fandom ?? NO_FANDOM_LABEL,
                  value: f.revenue,
                  display: (
                    <>
                      <span className="font-bold text-ink">{formatRub(f.revenue)}</span> · {pcs(f.units)}
                    </>
                  ),
                  title: `${f.fandom ?? NO_FANDOM_LABEL}: ${formatRub(f.revenue)} from ${f.units} pieces`,
                }))}
              />
            </Card>
          </div>

          <Card
            title="Customers"
            action={<span className="text-xs font-bold text-ink-muted">{customers.length} paying</span>}
            className="animate-pop"
          >
            {customers.length === 0 ? (
              <p className="py-3 text-sm text-ink-faint">No paid orders in this period.</p>
            ) : (
              <>
                <ol className="divide-y divide-line">
                  {(allCustomers ? customers : customers.slice(0, CUSTOMERS_N)).map((c, i) => (
                    <li key={c.key}>
                      <Link
                        to={`/orders/${c.lastOrderId}`}
                        className="tap flex min-h-11 items-center gap-3 py-2"
                      >
                        <span className="w-5 shrink-0 text-right text-xs font-bold text-ink-faint">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold">{c.label}</span>
                            {c.orders > 1 && (
                              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-bold text-brand">
                                <Repeat size={10} strokeWidth={3} />
                                {c.orders}×
                              </span>
                            )}
                          </span>
                          <span className="block text-2xs text-ink-faint">last order {formatDate(c.lastOrder)}</span>
                        </span>
                        <span className="shrink-0 font-display text-sm">{formatRub(c.spend)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {customers.length > CUSTOMERS_N && (
                  <button
                    type="button"
                    onClick={() => setAllCustomers(!allCustomers)}
                    className="tap mt-1 min-h-11 w-full rounded-full text-sm font-bold text-brand hover:bg-brand/10"
                  >
                    {allCustomers ? 'Show top 10' : `Show all ${customers.length}`}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
