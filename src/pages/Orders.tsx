import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Order, OrderItem } from '../lib/types'
import { useInsert, useList } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

type Filter = 'all' | 'unpaid' | 'to_send' | 'done'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'to_send', label: 'To send' },
  { key: 'done', label: 'Done' },
]

export default function Orders() {
  const { data: orders, isLoading } = useList<Order>('orders', { orderBy: 'created_at', ascending: false })
  const insert = useInsert<Order>('orders')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
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
          ]
            .filter(Boolean)
            .join('')

          return `<div class="order">
            <div class="order-header">
              <h2>${order.telegram || order.customer_email || 'Order'}</h2>
              ${extraInfo}
            </div>
            <div class="status">${statusParts.join(' &nbsp;·&nbsp; ')}</div>
            ${
              items.length > 0
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
        <h1 className="text-xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={printOrders}
            disabled={printLoading || filtered.length === 0}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            {printLoading ? 'Loading…' : `Print (${filtered.length})`}
          </button>
          <button onClick={() => setAdding(true)} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
            + New order
          </button>
        </div>
      </div>

      <input placeholder="Search telegram or email…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} mb-3`} />

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.key ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 shadow-sm'
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
            <button onClick={() => setDeliveryFilter('')} className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading && <EmptyState message="Loading…" />}
      {!isLoading && filtered.length === 0 && <EmptyState message="No orders found." />}

      <div className="space-y-2">
        {filtered.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm hover:bg-violet-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.telegram || o.customer_email || 'no contact'}</p>
              <p className="truncate text-xs text-gray-500">{o.delivery_method ?? 'no delivery method'}</p>
              <div className="mt-1 flex gap-1">
                <StatusBadge on={o.paid} label="paid" />
                <StatusBadge on={o.sent} label="sent" />
                <StatusBadge on={o.delivered} label="delivered" />
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold">{formatRub(o.total_price)}</span>
          </Link>
        ))}
      </div>

      <Modal title="New order" open={adding} onClose={() => setAdding(false)}>
        <form onSubmit={save}>
          <Field label="Telegram">
            <input className={inputClass} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          </Field>
          <p className="mb-3 text-xs text-gray-500">You can add items and details on the next screen.</p>
          <PrimaryButton type="submit" disabled={insert.isPending}>
            Create
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}
