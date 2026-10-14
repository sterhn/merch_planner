import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageOpen, BadgeCheck, Send, PackageCheck, Trash2, Loader2, Printer, RotateCcw, X } from 'lucide-react'
import type { Order, OrderItem, OrderWithPhotos } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatDate, formatRub, localISODate, todayISO } from '../lib/format'
import { agoLabel, daysBetween } from '../lib/greeting'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../hooks/useConfirm'
import FilterChip from '../components/FilterChip'
import Modal from '../components/Modal'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SECTIONS } from '../components/sections'
import { useLaunchFlag } from '../hooks/useLaunchFlag'
import { celebrate } from '../lib/confetti'
import SearchInput from '../components/SearchInput'
import SwipeableRow, { type SwipeAction } from '../components/SwipeableRow'
import { AddButton, Field, IconButton, inputClass, PrimaryButton, SecondaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'
import { showToast } from '../lib/toast'
import { openPrintWindow, orderListPageHtml } from '../lib/printOrder'
import {
  fandomGrouping,
  flushViewState,
  forgetOrder,
  lastOrder,
  ordersView,
  saveOrdersView,
} from '../lib/viewState'

type Filter = 'all' | 'unpaid' | 'to_send' | 'sent' | 'done'

/** Unpaid this long, an order row flags its age. */
const UNPAID_NUDGE_DAYS = 7

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'to_send', label: 'To send' },
  { key: 'sent', label: 'Sent' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
]

function matchesStatus(o: Order, filter: Filter): boolean {
  switch (filter) {
    case 'unpaid':
      return !o.paid
    case 'to_send':
      return o.paid && !o.sent
    case 'sent':
      return o.paid && o.sent && !o.delivered
    case 'done':
      return o.delivered
    case 'all':
      return true
  }
}

export default function Orders() {
  const { data: orders, isLoading, isError, refetch } = useList<OrderWithPhotos>('orders', {
    orderBy: 'created_at',
    ascending: false,
    select: '*, order_items(name_text, item:item_id(name, image_url))',
  })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const insert = useInsert<Order>('orders')
  // Invalidate 'items' too: marking an order sent changes catalog stock (DB trigger).
  const update = useUpdate<Order>('orders', ['items'])
  const remove = useDelete('orders')
  const { confirm, element: confirmSheet } = useConfirm()

  // Optimistic: flip the badge in every cached orders list immediately, and
  // fall back to a refetch if the save fails. Without this the swipe felt
  // laggy next to the same toggle on the order screen.
  function setStatus(id: string, values: Partial<Order>) {
    qc.setQueriesData<OrderWithPhotos[]>({ queryKey: ['orders'] }, (data) =>
      Array.isArray(data) ? data.map((o) => (o.id === id ? { ...o, ...values } : o)) : data,
    )
    update.mutate(
      { id, values },
      { onError: () => void qc.invalidateQueries({ queryKey: ['orders'] }) },
    )
  }

  // Packing day: print the "To send" list, pack everything, then mark the lot
  // sent in one go instead of a swipe per order.
  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, values }: { ids: string[]; values: Partial<Order> }) => {
      const { error } = await supabase.from('orders').update(values).in('id', ids)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['items'] })
    },
  })

  function setStatusMany(ids: string[], values: Partial<Order>) {
    const set = new Set(ids)
    qc.setQueriesData<OrderWithPhotos[]>({ queryKey: ['orders'] }, (data) =>
      Array.isArray(data) ? data.map((o) => (set.has(o.id) ? { ...o, ...values } : o)) : data,
    )
    bulkUpdate.mutate({ ids, values })
  }

  function markAllSent(ids: string[]) {
    confirm(
      `Mark all ${ids.length} as sent? Their items come off catalog stock.`,
      () => {
        celebrate()
        setStatusMany(ids, { sent: true })
        showToast(`${ids.length} order${ids.length !== 1 ? 's' : ''} marked sent`, {
          label: 'Undo',
          onClick: () => setStatusMany(ids, { sent: false }),
        })
      },
      { label: 'Mark sent', tone: 'primary' },
    )
  }

  // A swipe is easy to trigger by accident, and "sent" moves catalog stock, so
  // every advance offers an Undo. Un-sending restores stock (DB trigger).
  function advanceStatus(id: string, who: string, flag: 'paid' | 'sent' | 'delivered') {
    celebrate()
    setStatus(id, { [flag]: true })
    showToast(`${who} marked ${flag}`, { label: 'Undo', onClick: () => setStatus(id, { [flag]: false }) })
  }

  // Search, filters and scroll come back from the last visit, so leaving an
  // order half-entered and returning drops you where you stopped.
  const [search, setSearch] = useState(() => ordersView().search)
  const [searchParams, setSearchParams] = useSearchParams()
  const [savedFilter, setSavedFilter] = useState<Filter>(() => {
    const remembered = ordersView().filter
    return FILTERS.some((f) => f.key === remembered) ? (remembered as Filter) : 'to_send'
  })
  const filterParam = searchParams.get('filter')
  // A filter in the URL still wins, so shared/back-navigated links behave.
  const filter: Filter = FILTERS.some((f) => f.key === filterParam) ? (filterParam as Filter) : savedFilter
  const setFilter = (f: Filter) => {
    setSavedFilter(f)
    saveOrdersView({ filter: f })
    setSearchParams(f === 'to_send' ? {} : { filter: f }, { replace: true })
  }
  const [deliveryFilter, setDeliveryFilter] = useState(() => ordersView().delivery)
  const launchNew = useLaunchFlag()
  const [adding, setAdding] = useState(launchNew)
  const [form, setForm] = useState({ telegram: '', customer_email: '' })
  const [printLoading, setPrintLoading] = useState(false)
  const [resumeId, setResumeId] = useState(() => lastOrder()?.id ?? null)
  const [today] = useState(todayISO)

  const restoredScroll = useRef(false)

  // Track the scroll offset while browsing; a frame throttle keeps it off the
  // scroll hot path, and the flush persists whatever the last frame saw.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        saveOrdersView({ scrollY: window.scrollY })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      flushViewState()
    }
  }, [])

  // Restore once, after the first render that has rows to scroll through.
  useEffect(() => {
    if (restoredScroll.current || isLoading) return
    restoredScroll.current = true
    const { scrollY } = ordersView()
    if (scrollY > 0) window.scrollTo(0, scrollY)
  }, [isLoading])

  const deliveryTypes = useMemo(() => {
    const types = new Set<string>()
    for (const o of orders ?? []) if (o.delivery_method) types.add(o.delivery_method)
    return [...types].sort()
  }, [orders])

  // Search and delivery narrow the pool; the status chips then split it, each
  // chip showing how many it would leave.
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (orders ?? []).filter((o) => {
      if (q) {
        const contact = `${o.telegram ?? ''} ${o.customer_email ?? ''}`.toLowerCase()
        const itemNames = (o.order_items ?? [])
          .map((oi) => oi.item?.name ?? oi.name_text ?? '')
          .join(' ')
          .toLowerCase()
        if (!contact.includes(q) && !itemNames.includes(q)) return false
      }
      if (deliveryFilter && o.delivery_method !== deliveryFilter) return false
      return true
    })
  }, [orders, search, deliveryFilter])

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>
    for (const f of FILTERS) c[f.key] = pool.filter((o) => matchesStatus(o, f.key)).length
    return c
  }, [pool])

  const filtered = useMemo(() => pool.filter((o) => matchesStatus(o, filter)), [pool, filter])

  // Resolved against the loaded list, so a deleted order stops offering a jump
  // back and the card always shows the order's current contact.
  const resumeOrder = useMemo(
    () => (resumeId ? (orders ?? []).find((o) => o.id === resumeId) : undefined),
    [orders, resumeId],
  )

  async function printOrders() {
    if (filtered.length === 0) return
    setPrintLoading(true)

    try {
      const orderIds = filtered.map((o) => o.id)

      const [{ data: allItems }, { data: catalog }] = await Promise.all([
        supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds)
          .order('position', { ascending: true, nullsFirst: false })
          .order('created_at'),
        supabase.from('items').select('id, name, fandom'),
      ])

      const catalogMap = new Map<string, { name: string; fandom: string | null }>()
      for (const item of catalog ?? []) catalogMap.set(item.id, { name: item.name, fandom: item.fandom })

      const linesByOrder = new Map<string, OrderItem[]>()
      for (const line of (allItems ?? []) as OrderItem[]) {
        if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, [])
        linesByOrder.get(line.order_id)!.push(line)
      }

      const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? 'All'
      openPrintWindow(
        orderListPageHtml({
          orders: filtered,
          linesByOrder,
          catalog: catalogMap,
          // Printouts follow the grouping toggle set on the order screen.
          groupByFandom: fandomGrouping(),
          heading: deliveryFilter ? `${filterLabel} · ${deliveryFilter}` : filterLabel,
          printedOn: formatDate(todayISO()),
        }),
      )
    } finally {
      setPrintLoading(false)
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    insert.mutate(
      { telegram: form.telegram || null, customer_email: form.customer_email || null },
      {
        onSuccess: (created) => {
          setAdding(false)
          setForm({ telegram: '', customer_email: '' })
          navigate(`/orders/${created.id}`)
        },
      },
    )
  }

  return (
    <div>
      <PageHeader title="Orders" icon={SECTIONS.orders.icon} tone={SECTIONS.orders.tone}>
        <IconButton
          icon={printLoading ? Loader2 : Printer}
          label="Print orders"
          onClick={printOrders}
          disabled={printLoading || filtered.length === 0}
          className={printLoading ? '[&_svg]:animate-spin' : ''}
        />
        <AddButton onClick={() => setAdding(true)}>New order</AddButton>
      </PageHeader>

      {resumeOrder && (
        <div className="mb-3 flex items-center gap-1 rounded-card border border-brand/25 bg-brand/5 p-1 pl-3.5 print:hidden">
          <Link to={`/orders/${resumeOrder.id}`} className="tap flex min-h-11 min-w-0 flex-1 items-center gap-3">
            <RotateCcw size={16} className="shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-brand">Continue where you left off</p>
              <p className="truncate text-sm font-semibold">
                {resumeOrder.telegram || resumeOrder.customer_email || 'no contact'}
              </p>
            </div>
          </Link>
          <IconButton
            icon={X}
            label="Dismiss"
            onClick={() => {
              haptic(5)
              forgetOrder()
              setResumeId(null)
            }}
          />
        </div>
      )}

      <SearchInput
        className="mb-3"
        label="Search orders"
        placeholder="Search contact or items…"
        value={search}
        onChange={(value) => {
          setSearch(value)
          saveOrdersView({ search: value })
        }}
      />

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} count={counts[f.key]}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {deliveryTypes.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className={`${inputClass} max-w-48 text-xs`}
            aria-label="Filter by delivery type"
            value={deliveryFilter}
            onChange={(e) => {
              setDeliveryFilter(e.target.value)
              saveOrdersView({ delivery: e.target.value })
            }}
          >
            <option value="">All delivery types</option>
            {deliveryTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {deliveryFilter && (
            <button
              onClick={() => {
                setDeliveryFilter('')
                saveOrdersView({ delivery: '' })
              }}
              className="tap min-h-11 px-2 text-xs font-bold text-ink-faint hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {filter === 'to_send' && filtered.length > 0 && (
        <SecondaryButton
          tone="good"
          className="mb-3 w-full"
          onClick={() => markAllSent(filtered.map((o) => o.id))}
          disabled={bulkUpdate.isPending}
        >
          <Send size={15} />
          Mark all {filtered.length} as sent
        </SecondaryButton>
      )}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={filtered.length === 0}
        icon={PackageOpen}
        tone={SECTIONS.orders.tone}
        errorMessage="Failed to load orders."
        emptyMessage="No orders found."
        emptyHint="Swipe left to advance status, right to delete."
        onRetry={() => void refetch()}
      />

      <div className="space-y-2">
        {filtered.map((o) => {
          const photos = [...new Set(
            (o.order_items ?? []).map((oi) => oi.item?.image_url).filter(Boolean) as string[]
          )].slice(0, 6)
          const who = o.telegram || o.customer_email || 'no contact'
          const advance: SwipeAction | undefined = !o.paid
            ? {
                icon: BadgeCheck,
                label: 'paid',
                tone: 'good',
                onAction: () => advanceStatus(o.id, who, 'paid'),
              }
            : !o.sent
              ? {
                  icon: Send,
                  label: 'sent',
                  tone: 'accent',
                  onAction: () => advanceStatus(o.id, who, 'sent'),
                }
              : !o.delivered
                ? {
                    icon: PackageCheck,
                    label: 'delivered',
                    tone: 'brand',
                    onAction: () => advanceStatus(o.id, who, 'delivered'),
                  }
                : undefined
          const onDelete = () => {
            confirm('Delete this order?', () => remove.mutate(o.id))
          }
          const AdvanceIcon = advance?.icon
          // How long it's been waiting, where that's worth a glance.
          const unpaidDays = o.paid ? 0 : daysBetween(localISODate(o.created_at), today)
          const age = !o.paid && unpaidDays >= UNPAID_NUDGE_DAYS
            ? { text: `unpaid ${unpaidDays} days`, bad: true }
            : o.sent && !o.delivered && o.sent_at
              ? { text: `sent ${agoLabel(daysBetween(localISODate(o.sent_at), today))}`, bad: false }
              : null
          return (
            <SwipeableRow
              key={o.id}
              left={{ icon: Trash2, label: 'delete', tone: 'bad', onAction: onDelete }}
              right={advance}
            >
              <div className="flex items-center rounded-card glass">
                <Link
                  to={`/orders/${o.id}`}
                  className="tap flex min-w-0 flex-1 items-center justify-between gap-3 p-3.5"
                >
                  {photos.length > 0 && (
                    <div className="flex shrink-0 flex-col gap-0.5">
                      {photos.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt="" className="size-7 rounded-lg object-cover" loading="lazy" />
                      ))}
                      {photos.length > 3 && (
                        <span className="text-center text-xs text-ink-faint">+{photos.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{who}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {o.delivery_method ?? 'no delivery method'}
                      {age && <span className={age.bad ? 'font-bold text-bad' : ''}> · {age.text}</span>}
                    </p>
                    <div className="mt-1.5">
                      <OrderStatus paid={o.paid} sent={o.sent} delivered={o.delivered} />
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
                </Link>
                {/* SwipeableRow ignores mouse pointers, so without these the only way
                    to delete or advance an order on a laptop would be to open it. */}
                <div className="hidden shrink-0 items-center gap-0.5 pr-2 md:flex">
                  {advance && AdvanceIcon && (
                    <IconButton
                      icon={AdvanceIcon}
                      size={10}
                      tone="good"
                      label={`Mark ${who} as ${advance.label}`}
                      onClick={advance.onAction}
                    />
                  )}
                  <IconButton
                    icon={Trash2}
                    size={10}
                    tone="danger"
                    label={`Delete order from ${who}`}
                    onClick={onDelete}
                  />
                </div>
              </div>
            </SwipeableRow>
          )
        })}
      </div>

      <Modal title="New order" open={adding} onClose={() => setAdding(false)}>
        <form onSubmit={save}>
          <Field label="Telegram">
            <input className={inputClass} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          </Field>
          <p className="mb-3 text-xs text-ink-muted">You can add items and details on the next screen.</p>
          <PrimaryButton type="submit" disabled={insert.isPending}>
            Create
          </PrimaryButton>
        </form>
      </Modal>

      {confirmSheet}
    </div>
  )
}
