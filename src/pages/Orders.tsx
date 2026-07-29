import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PackageOpen, BadgeCheck, Send, PackageCheck, Trash2, Loader2, Printer, RotateCcw, X } from 'lucide-react'
import type { Order, OrderItem, OrderWithPhotos } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import { supabase } from '../lib/supabase'
import FilterChip from '../components/FilterChip'
import Modal from '../components/Modal'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import SearchInput from '../components/SearchInput'
import SwipeableRow, { type SwipeAction } from '../components/SwipeableRow'
import { AddButton, Field, IconButton, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'
import { groupLinesByFandom, NO_FANDOM_LABEL, sortLinesByPrice } from '../lib/orderLines'
import {
  fandomGrouping,
  flushViewState,
  forgetOrder,
  lastOrder,
  ordersView,
  saveOrdersView,
} from '../lib/viewState'

type Filter = 'all' | 'unpaid' | 'to_send' | 'sent' | 'done'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'to_send', label: 'To send' },
  { key: 'sent', label: 'Sent' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
]

export default function Orders() {
  const { data: orders, isLoading, isError, refetch } = useList<OrderWithPhotos>('orders', {
    orderBy: 'created_at',
    ascending: false,
    select: '*, order_items(name_text, item:item_id(name, image_url))',
  })
  const navigate = useNavigate()
  const insert = useInsert<Order>('orders')
  // Invalidate 'items' too: marking an order sent changes catalog stock (DB trigger).
  const update = useUpdate<Order>('orders', ['items'])
  const remove = useDelete('orders')

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
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ telegram: '', customer_email: '' })
  const [printLoading, setPrintLoading] = useState(false)
  const [resumeId, setResumeId] = useState(() => lastOrder()?.id ?? null)

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

  const filtered = useMemo(() => {
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
      if (filter === 'unpaid' && o.paid) return false
      if (filter === 'to_send' && !(o.paid && !o.sent)) return false
      if (filter === 'sent' && !(o.paid && o.sent && !o.delivered)) return false
      if (filter === 'done' && !o.delivered) return false
      if (deliveryFilter && o.delivery_method !== deliveryFilter) return false
      return true
    })
  }, [orders, search, filter, deliveryFilter])

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

      // Printouts follow the grouping toggle set on the order screen.
      const groupByFandom = fandomGrouping()

      const itemsByOrder = new Map<string, OrderItem[]>()
      for (const item of (allItems ?? []) as OrderItem[]) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, [])
        itemsByOrder.get(item.order_id)!.push(item)
      }

      const ordersHtml = filtered
        .map((order) => {
          const items = itemsByOrder.get(order.id) ?? []
          const linesTotal = items.reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0)

          const rowsFor = (lines: OrderItem[]) =>
            lines
              .map((l) => {
                const name = (l.item_id ? catalogMap.get(l.item_id)?.name : null) ?? l.name_text ?? '—'
                return `<tr>
                <td>${name}</td>
                <td style="text-align:center">${l.qty}</td>
                <td style="text-align:right">${formatRub(l.unit_price)}</td>
                <td style="text-align:right">${formatRub((l.unit_price ?? 0) * l.qty)}</td>
              </tr>`
              })
              .join('')

          const groups = groupByFandom ? groupLinesByFandom(items, catalogMap) : []
          const itemRows =
            groups.length > 1
              ? groups
                  .map(
                    (g) =>
                      `<tr class="group"><td colspan="4">${g.fandom ?? NO_FANDOM_LABEL}</td></tr>${rowsFor(g.lines)}`,
                  )
                  .join('')
              : rowsFor(sortLinesByPrice(items))

          const statusParts = [
            order.paid ? '✓ Paid' : '✗ Not paid',
            order.sent ? '✓ Sent' : '✗ Not sent',
            order.delivered ? '✓ Delivered' : '✗ Not delivered',
          ]

          const extraInfo = [
            order.delivery_method ? `<span class="badge">${order.delivery_method}</span>` : '',
            order.delivery_details ? `<div class="meta">${order.delivery_details}</div>` : '',
            order.comment ? `<div class="meta comment">Note: ${order.comment}</div>` : '',
          ].filter(Boolean).join('')

          return `<div class="order">
            <div class="order-header">
              <h2>${order.telegram || order.customer_email || 'Order'}</h2>
              ${extraInfo}
            </div>
            <div class="status">${statusParts.join(' &nbsp;·&nbsp; ')}</div>
            ${items.length > 0
              ? `<table>
                  <thead><tr>
                    <th>Item</th>
                    <th style="text-align:center">Qty</th>
                    <th style="text-align:right">Price</th>
                    <th style="text-align:right">Subtotal</th>
                  </tr></thead>
                  <tbody>${itemRows}</tbody>
                </table>
                <div class="items-total">Items total: ${formatRub(linesTotal)}</div>`
              : '<p class="no-items">No items added</p>'
            }
            ${order.total_price != null ? `<div class="order-total">Order total: ${formatRub(order.total_price)}</div>` : ''}
          </div>`
        })
        .join('')

      const filterLabel =
        filter === 'to_send' ? 'To send' : filter === 'sent' ? 'Sent' : filter === 'unpaid' ? 'Unpaid' : filter === 'done' ? 'Done' : 'All'
      const deliveryLabel = deliveryFilter ? ` · ${deliveryFilter}` : ''

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orders – ${filterLabel}${deliveryLabel} – ${new Date().toLocaleDateString('ru-RU')}</title>
  <style>
    body { font-family: sans-serif; font-size: 12px; padding: 20px 28px; color: #111; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 14px; color: #555; margin: 0 0 20px; font-weight: normal; }
    .order { border-top: 2px solid #333; padding-top: 10px; margin-bottom: 18px; page-break-inside: avoid; }
    .order-header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 3px; }
    h2 { font-size: 14px; margin: 0; }
    .badge { background: #eee; border-radius: 4px; padding: 1px 6px; font-size: 10px; }
    .status { font-size: 10px; color: #666; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #444; margin-top: 1px; }
    .comment { color: #888; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 3px; }
    th { text-align: left; border-bottom: 1px solid #333; padding: 3px 6px 3px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 3px 6px 3px 0; border-bottom: 1px solid #eee; font-size: 11px; }
    tr.group td { padding-top: 7px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1px solid #ccc; }
    .items-total { text-align: right; font-size: 10px; color: #666; }
    .order-total { text-align: right; font-weight: bold; font-size: 13px; margin-top: 2px; }
    .no-items { color: #aaa; font-size: 11px; margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Orders · ${filterLabel}${deliveryLabel} · ${new Date().toLocaleDateString('ru-RU')} · ${filtered.length} order${filtered.length !== 1 ? 's' : ''}</h1>
  ${ordersHtml}
</body>
</html>`

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        win.print()
      }
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
      <PageHeader title="Orders">
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
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
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

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={filtered.length === 0}
        icon={PackageOpen}
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
          const advance: SwipeAction | undefined = !o.paid
            ? {
                icon: BadgeCheck,
                label: 'paid',
                tone: 'good',
                onAction: () => update.mutate({ id: o.id, values: { paid: true } }),
              }
            : !o.sent
              ? {
                  icon: Send,
                  label: 'sent',
                  tone: 'accent',
                  onAction: () => update.mutate({ id: o.id, values: { sent: true } }),
                }
              : !o.delivered
                ? {
                    icon: PackageCheck,
                    label: 'delivered',
                    tone: 'brand',
                    onAction: () => update.mutate({ id: o.id, values: { delivered: true } }),
                  }
                : undefined
          const who = o.telegram || o.customer_email || 'no contact'
          const onDelete = () => {
            if (confirm('Delete this order?')) remove.mutate(o.id)
          }
          const AdvanceIcon = advance?.icon
          return (
            <SwipeableRow
              key={o.id}
              left={{ icon: Trash2, label: 'delete', tone: 'bad', onAction: onDelete }}
              right={advance}
            >
              <div className="flex items-center rounded-card bg-surface shadow-card">
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
                    <p className="truncate text-xs text-ink-muted">{o.delivery_method ?? 'no delivery method'}</p>
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
    </div>
  )
}
