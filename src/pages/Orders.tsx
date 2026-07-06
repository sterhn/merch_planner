import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, PackageOpen, BadgeCheck, Trash2, Loader2, Printer } from 'lucide-react'
import type { Order, OrderItem, OrderWithPhotos } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import SwipeableRow from '../components/SwipeableRow'
import { Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

type Filter = 'all' | 'unpaid' | 'to_send' | 'done'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'to_send', label: 'To send' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
]

function OrderStatus({ paid, sent, delivered }: { paid: boolean; sent: boolean; delivered: boolean }) {
  if (delivered) return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">Delivered</span>
  if (sent) return <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-700">Shipped</span>
  if (paid) return <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">Awaiting shipment</span>
  return <span className="rounded-full bg-bad/10 px-2.5 py-0.5 text-xs font-bold text-bad">Unpaid</span>
}

export default function Orders() {
  const { data: orders, isLoading, isError, refetch } = useList<OrderWithPhotos>('orders', {
    orderBy: 'created_at',
    ascending: false,
    select: '*, order_items(item:item_id(image_url))',
  })
  const insert = useInsert<Order>('orders')
  const update = useUpdate<Order>('orders')
  const remove = useDelete('orders')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('to_send')
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ telegram: '', customer_email: '' })
  const [printLoading, setPrintLoading] = useState(false)

  const deliveryTypes = useMemo(() => {
    const types = new Set<string>()
    for (const o of orders ?? []) if (o.delivery_method) types.add(o.delivery_method)
    return [...types].sort()
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (orders ?? []).filter((o) => {
      if (q && !`${o.telegram ?? ''} ${o.customer_email ?? ''}`.toLowerCase().includes(q)) return false
      if (filter === 'unpaid' && o.paid) return false
      if (filter === 'to_send' && !(o.paid && !o.sent)) return false
      if (filter === 'done' && !o.delivered) return false
      if (deliveryFilter && o.delivery_method !== deliveryFilter) return false
      return true
    })
  }, [orders, search, filter, deliveryFilter])

  async function printOrders() {
    if (filtered.length === 0) return
    setPrintLoading(true)

    try {
      const orderIds = filtered.map((o) => o.id)

      const [{ data: allItems }, { data: catalog }] = await Promise.all([
        supabase.from('order_items').select('*').in('order_id', orderIds).order('created_at'),
        supabase.from('items').select('id, name'),
      ])

      const catalogMap = new Map<string, string>()
      for (const item of catalog ?? []) catalogMap.set(item.id, item.name)

      const itemsByOrder = new Map<string, OrderItem[]>()
      for (const item of (allItems ?? []) as OrderItem[]) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, [])
        itemsByOrder.get(item.order_id)!.push(item)
      }

      const ordersHtml = filtered
        .map((order) => {
          const items = itemsByOrder.get(order.id) ?? []
          const linesTotal = items.reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0)

          const itemRows = items
            .map((l) => {
              const name = l.item_id ? (catalogMap.get(l.item_id) ?? l.name_text ?? '—') : (l.name_text ?? '—')
              return `<tr>
                <td>${name}</td>
                <td style="text-align:center">${l.qty}</td>
                <td style="text-align:right">${formatRub(l.unit_price)}</td>
                <td style="text-align:right">${formatRub((l.unit_price ?? 0) * l.qty)}</td>
              </tr>`
            })
            .join('')

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

      const filterLabel = filter === 'to_send' ? 'To send' : filter === 'unpaid' ? 'Unpaid' : filter === 'done' ? 'Done' : 'All'
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
        onSuccess: () => {
          setAdding(false)
          setForm({ telegram: '', customer_email: '' })
        },
      },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={printOrders}
            disabled={printLoading || filtered.length === 0}
            aria-label="Print orders"
            title="Print orders"
            className="tap flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            {printLoading ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
          </button>
          <button
            onClick={() => {
              haptic()
              setAdding(true)
            }}
            className="tap flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card"
          >
            <Plus size={16} strokeWidth={3} />
            New order
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          placeholder="Search telegram or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-11`}
        />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              haptic(5)
              setFilter(f.key)
            }}
            className={`tap h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${
              filter === f.key
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-card'
                : 'bg-surface-2 text-ink-muted shadow-card hover:bg-surface-2'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {deliveryTypes.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className={`${inputClass} max-w-48 text-xs`}
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
          >
            <option value="">All delivery types</option>
            {deliveryTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {deliveryFilter && (
            <button onClick={() => setDeliveryFilter('')} className="tap min-h-11 px-2 text-xs font-bold text-ink-faint hover:text-ink">
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {isError && <EmptyState icon={PackageOpen} message="Failed to load orders." onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon={PackageOpen} message="No orders found." hint="Swipe a row to mark paid or delete." />
      )}

      <div className="space-y-2">
        {filtered.map((o) => {
          const photos = [...new Set(
            (o.order_items ?? []).map((oi) => oi.item?.image_url).filter(Boolean) as string[]
          )].slice(0, 6)
          return (
            <SwipeableRow
              key={o.id}
              left={{
                icon: BadgeCheck,
                label: o.paid ? 'unpaid' : 'paid',
                className: 'bg-emerald-500',
                onAction: () => update.mutate({ id: o.id, values: { paid: !o.paid } }),
              }}
              right={{
                icon: Trash2,
                label: 'delete',
                className: 'bg-rose-500',
                onAction: () => {
                  if (confirm('Delete this order?')) remove.mutate(o.id)
                },
              }}
            >
              <Link
                to={`/orders/${o.id}`}
                className="tap flex items-center justify-between gap-3 rounded-card bg-surface p-3.5 shadow-card"
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
                  <p className="truncate text-sm font-bold">{o.telegram || o.customer_email || 'no contact'}</p>
                  <p className="truncate text-xs text-ink-muted">{o.delivery_method ?? 'no delivery method'}</p>
                  <div className="mt-1.5">
                    <OrderStatus paid={o.paid} sent={o.sent} delivered={o.delivered} />
                  </div>
                </div>
                <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
              </Link>
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
