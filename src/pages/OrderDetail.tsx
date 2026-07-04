import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Item, Order, OrderItem } from '../lib/types'
import { DELIVERY_METHODS } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

function HeaderForm({
  order,
  pending,
  onSave,
}: {
  order: Order
  pending: boolean
  onSave: (values: Partial<Order>) => void
}) {
  const [form, setForm] = useState({
    telegram: order.telegram ?? '',
    customer_email: order.customer_email ?? '',
    total_price: order.total_price?.toString() ?? '',
    delivery_method: order.delivery_method ?? '',
    delivery_details: order.delivery_details ?? '',
    comment: order.comment ?? '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      telegram: form.telegram || null,
      customer_email: form.customer_email || null,
      total_price: form.total_price === '' ? null : Number(form.total_price),
      delivery_method: form.delivery_method || null,
      delivery_details: form.delivery_details || null,
      comment: form.comment || null,
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-4 shadow-sm print:hidden">
      <h2 className="mb-3 text-sm font-semibold text-gray-600">Details</h2>
      <div className="grid gap-x-3 md:grid-cols-2">
        <Field label="Telegram">
          <input className={inputClass} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
        </Field>
        <Field label="Total ₽">
          <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} />
        </Field>
        <Field label="Delivery method">
          <select className={inputClass} value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}>
            <option value="">—</option>
            {DELIVERY_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Delivery details / address">
        <textarea className={inputClass} rows={3} value={form.delivery_details} onChange={(e) => setForm({ ...form, delivery_details: e.target.value })} />
      </Field>
      <Field label="Comment">
        <textarea className={inputClass} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      </Field>
      <PrimaryButton type="submit" disabled={pending}>
        Save details
      </PrimaryButton>
    </form>
  )
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: order } = useQuery({
    queryKey: ['orders', id],
    queryFn: async (): Promise<Order> => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Order
    },
    enabled: Boolean(id),
  })

  const { data: lines } = useQuery({
    queryKey: ['order_items', id],
    queryFn: async (): Promise<OrderItem[]> => {
      const { data, error } = await supabase.from('order_items').select('*').eq('order_id', id!).order('created_at')
      if (error) throw error
      return data as OrderItem[]
    },
    enabled: Boolean(id),
  })

  const { data: catalog } = useList<Item>('items', { orderBy: 'name' })
  const updateOrder = useUpdate<Order>('orders')
  const deleteOrder = useDelete('orders')
  const insertLine = useInsert<OrderItem>('order_items')
  const deleteLine = useDelete('order_items')

  const [addingLine, setAddingLine] = useState(false)
  const [lineForm, setLineForm] = useState({ item_id: '', name_text: '', qty: '1', unit_price: '' })
  const [lineSearch, setLineSearch] = useState('')
  const [lineTypeFilter, setLineTypeFilter] = useState('')

  const itemNames = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of catalog ?? []) map.set(i.id, i)
    return map
  }, [catalog])

  const catalogTypes = useMemo(() => {
    const types = new Set<string>()
    for (const i of catalog ?? []) if (i.type) types.add(i.type)
    return [...types].sort()
  }, [catalog])

  const filteredCatalog = useMemo(() => {
    const q = lineSearch.trim().toLowerCase()
    return (catalog ?? []).filter((i) => {
      if (lineTypeFilter && i.type !== lineTypeFilter) return false
      if (q && !`${i.name} ${i.fandom ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalog, lineSearch, lineTypeFilter])

  const linesTotal = useMemo(
    () => (lines ?? []).reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0),
    [lines],
  )

  if (!order) return <p className="py-12 text-center text-sm text-gray-400">Loading…</p>

  function invalidateDetail() {
    qc.invalidateQueries({ queryKey: ['orders', id] })
    qc.invalidateQueries({ queryKey: ['orders'] })
  }

  function toggle(flag: 'paid' | 'sent' | 'delivered') {
    updateOrder.mutate({ id: id!, values: { [flag]: !order![flag] } }, { onSuccess: invalidateDetail })
  }

  function closeAddLine() {
    setAddingLine(false)
    setLineForm({ item_id: '', name_text: '', qty: '1', unit_price: '' })
    setLineSearch('')
    setLineTypeFilter('')
  }

  function addLine(e: React.FormEvent) {
    e.preventDefault()
    const picked = lineForm.item_id ? itemNames.get(lineForm.item_id) : undefined
    insertLine.mutate(
      {
        order_id: id!,
        item_id: lineForm.item_id || null,
        name_text: lineForm.name_text || picked?.name || null,
        qty: Number(lineForm.qty) || 1,
        unit_price: lineForm.unit_price !== '' ? Number(lineForm.unit_price) : (picked?.sale_price ?? null),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['order_items', id] })
          closeAddLine()
        },
      },
    )
  }

  function printOrder() {
    const customerName = order!.telegram || order!.customer_email || 'Order'
    const date = new Date(order!.created_at).toLocaleDateString('ru-RU')

    const statusParts = [
      order!.paid ? '✓ Paid' : '✗ Not paid',
      order!.sent ? '✓ Sent' : '✗ Not sent',
      order!.delivered ? '✓ Delivered' : '✗ Not delivered',
    ]

    const itemRows = (lines ?? [])
      .map((l) => {
        const catalogItem = l.item_id ? itemNames.get(l.item_id) : undefined
        const name = catalogItem?.name ?? l.name_text ?? '—'
        const price = l.unit_price ?? 0
        const subtotal = price * l.qty
        return `<tr>
          <td>${name}</td>
          <td style="text-align:center">${l.qty}</td>
          <td style="text-align:right">${formatRub(price)}</td>
          <td style="text-align:right">${formatRub(subtotal)}</td>
        </tr>`
      })
      .join('')

    const extraInfo = [
      order!.delivery_method ? `<p><strong>Delivery:</strong> ${order!.delivery_method}</p>` : '',
      order!.delivery_details ? `<p><strong>Address:</strong> ${order!.delivery_details}</p>` : '',
      order!.customer_email ? `<p><strong>Email:</strong> ${order!.customer_email}</p>` : '',
      order!.comment ? `<p><strong>Comment:</strong> ${order!.comment}</p>` : '',
    ]
      .filter(Boolean)
      .join('')

    const totalLine =
      order!.total_price != null
        ? `<p style="text-align:right;font-weight:bold;font-size:15px">Order total: ${formatRub(order!.total_price)}</p>`
        : ''

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order – ${customerName}</title>
  <style>
    body { font-family: sans-serif; font-size: 13px; padding: 28px 32px; color: #111; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .date { color: #666; margin-bottom: 12px; font-size: 12px; }
    .status { display: flex; gap: 20px; margin-bottom: 16px; font-size: 12px; color: #444; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 5px 6px 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    th:not(:first-child) { text-align: right; }
    td { padding: 5px 6px 5px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    .items-total { text-align: right; font-size: 12px; color: #555; margin-bottom: 4px; }
    .order-total { text-align: right; font-weight: bold; font-size: 15px; margin-bottom: 16px; }
    .info { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
    .info p { margin: 3px 0; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${customerName}</h1>
  <div class="date">${date}</div>
  <div class="status">${statusParts.join('<span style="color:#ccc">|</span>')}</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Price</th>
        <th style="text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="items-total">Items total: ${formatRub(linesTotal)}</div>
  ${totalLine}
  ${extraInfo ? `<div class="info">${extraInfo}</div>` : ''}
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/orders')} className="mb-3 text-sm text-violet-700 print:hidden">
        ← Back to orders
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-bold">{order.telegram || order.customer_email || 'Order'}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={printOrder}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 print:hidden"
          >
            Print / PDF
          </button>
          <span className="text-lg font-bold">{formatRub(order.total_price)}</span>
        </div>
      </div>

      <div className="mb-5 flex gap-2 print:hidden">
        <StatusBadge on={order.paid} label="paid" onClick={() => toggle('paid')} />
        <StatusBadge on={order.sent} label="sent" onClick={() => toggle('sent')} />
        <StatusBadge on={order.delivered} label="delivered" onClick={() => toggle('delivered')} />
      </div>

      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600">Items</h2>
          <button onClick={() => setAddingLine(true)} className="text-sm font-medium text-violet-700 print:hidden">
            + Add item
          </button>
        </div>
        {(lines ?? []).length === 0 && <p className="py-3 text-sm text-gray-400">No items.</p>}
        <ul className="divide-y divide-gray-100">
          {(lines ?? []).map((l) => {
            const catalogItem = l.item_id ? itemNames.get(l.item_id) : undefined
            return (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {catalogItem?.name ?? l.name_text ?? '—'}
                    {l.qty > 1 && <span className="text-gray-500"> ×{l.qty}</span>}
                  </p>
                  {l.category && <p className="text-xs text-gray-400">{l.category}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm">{formatRub(l.unit_price)}</span>
                  <button
                    onClick={() => {
                      if (confirm('Remove this item?'))
                        deleteLine.mutate(l.id, {
                          onSuccess: () => qc.invalidateQueries({ queryKey: ['order_items', id] }),
                        })
                    }}
                    className="rounded p-1 text-gray-400 hover:text-red-600 print:hidden"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {(lines ?? []).length > 0 && (
          <p className="mt-2 text-right text-xs text-gray-500">items total: {formatRub(linesTotal)}</p>
        )}
      </section>

      <HeaderForm
        key={`${order.id}-${order.created_at}`}
        order={order}
        pending={updateOrder.isPending}
        onSave={(values) => updateOrder.mutate({ id: id!, values }, { onSuccess: invalidateDetail })}
      />

      <button
        onClick={() => {
          if (confirm('Delete this whole order?'))
            deleteOrder.mutate(id!, { onSuccess: () => navigate('/orders') })
        }}
        className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 print:hidden"
      >
        Delete order
      </button>

      <Modal title="Add item" open={addingLine} onClose={closeAddLine}>
        <form onSubmit={addLine}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Search by name / fandom">
              <input
                className={inputClass}
                placeholder="e.g. kdj, acnh…"
                value={lineSearch}
                onChange={(e) => {
                  setLineSearch(e.target.value)
                  setLineForm((f) => ({ ...f, item_id: '' }))
                }}
              />
            </Field>
            <Field label="Filter by type">
              <select
                className={inputClass}
                value={lineTypeFilter}
                onChange={(e) => {
                  setLineTypeFilter(e.target.value)
                  setLineForm((f) => ({ ...f, item_id: '' }))
                }}
              >
                <option value="">All types</option>
                {catalogTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="From catalog">
            <select
              className={inputClass}
              value={lineForm.item_id}
              onChange={(e) => {
                const picked = itemNames.get(e.target.value)
                setLineForm({
                  ...lineForm,
                  item_id: e.target.value,
                  unit_price: picked?.sale_price?.toString() ?? lineForm.unit_price,
                })
              }}
            >
              <option value="">— custom item —</option>
              {filteredCatalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.fandom ? ` · ${i.fandom}` : ''}
                  {i.type ? ` [${i.type}]` : ''} ({formatRub(i.sale_price)})
                </option>
              ))}
            </select>
          </Field>
          {!lineForm.item_id && (
            <Field label="Custom name">
              <input className={inputClass} value={lineForm.name_text} onChange={(e) => setLineForm({ ...lineForm, name_text: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty">
              <input className={inputClass} type="number" min="1" inputMode="numeric" value={lineForm.qty} onChange={(e) => setLineForm({ ...lineForm, qty: e.target.value })} />
            </Field>
            <Field label="Unit price ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={lineForm.unit_price} onChange={(e) => setLineForm({ ...lineForm, unit_price: e.target.value })} />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={insertLine.isPending}>
            Add
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}
