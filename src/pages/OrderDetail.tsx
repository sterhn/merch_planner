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

function CatalogPicker({ catalog, value, onSelect }: {
  catalog: Item[]
  value: string
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [fandomFilter, setFandomFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const fandoms = useMemo(() => {
    const s = new Set(catalog.map((i) => i.fandom).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [catalog])

  const types = useMemo(() => {
    const s = new Set(catalog.map((i) => i.type).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [catalog])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((i) => {
      if (fandomFilter && i.fandom !== fandomFilter) return false
      if (typeFilter && i.type !== typeFilter) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        (i.fandom ?? '').toLowerCase().includes(q) ||
        (i.type ?? '').toLowerCase().includes(q)
      )
    })
  }, [catalog, search, fandomFilter, typeFilter])

  return (
    <div>
      <input
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputClass} mb-2`}
      />
      {types.length > 0 && (
        <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-1">
          {[null, ...types].map((t) => (
            <button
              key={t ?? '__all_types__'}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeFilter === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t ?? 'All types'}
            </button>
          ))}
        </div>
      )}
      {fandoms.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {[null, ...fandoms].map((f) => (
            <button
              key={f ?? '__all__'}
              type="button"
              onClick={() => setFandomFilter(f)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${fandomFilter === f ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f ?? 'All fandoms'}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`flex w-full items-center px-3 py-2.5 text-left text-sm italic ${value === '' ? 'bg-violet-50 font-medium text-violet-700' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          — custom item —
        </button>
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-2.5 border-t border-gray-100 px-3 py-2 text-left ${value === item.id ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
          >
            {item.image_url ? (
              <img src={item.image_url} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
            ) : (
              <div className="size-9 shrink-0 rounded-lg bg-gray-100" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
            <span className="shrink-0 text-sm font-semibold text-gray-700">{formatRub(item.sale_price)}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No items found</p>
        )}
      </div>
    </div>
  )
}

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
    <form onSubmit={submit} className="rounded-xl bg-white p-4 shadow-sm">
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
  // Invalidate 'items' too: marking an order sent changes catalog stock (DB trigger).
  const updateOrder = useUpdate<Order>('orders', ['items'])
  const deleteOrder = useDelete('orders')
  const insertLine = useInsert<OrderItem>('order_items')
  const deleteLine = useDelete('order_items')

  const [addingLine, setAddingLine] = useState(false)
  const [lineForm, setLineForm] = useState({ item_id: '', name_text: '', qty: '1', unit_price: '' })

  const itemNames = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of catalog ?? []) map.set(i.id, i)
    return map
  }, [catalog])

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
    // Optimistic: flip the badge immediately, roll back if the save fails.
    const previous = qc.getQueryData<Order>(['orders', id])
    qc.setQueryData<Order>(['orders', id], (o) => (o ? { ...o, [flag]: !o[flag] } : o))
    updateOrder.mutate(
      { id: id!, values: { [flag]: !order![flag] } },
      {
        onSuccess: invalidateDetail,
        onError: () => qc.setQueryData(['orders', id], previous),
      },
    )
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
          setAddingLine(false)
          setLineForm({ item_id: '', name_text: '', qty: '1', unit_price: '' })
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
        return `<tr>
          <td>${name}</td>
          <td style="text-align:center">${l.qty}</td>
          <td style="text-align:right">${formatRub(price)}</td>
          <td style="text-align:right">${formatRub(price * l.qty)}</td>
        </tr>`
      })
      .join('')

    const extraInfo = [
      order!.delivery_method ? `<p><strong>Delivery:</strong> ${order!.delivery_method}</p>` : '',
      order!.delivery_details ? `<p><strong>Address:</strong> ${order!.delivery_details}</p>` : '',
      order!.customer_email ? `<p><strong>Email:</strong> ${order!.customer_email}</p>` : '',
      order!.comment ? `<p><strong>Comment:</strong> ${order!.comment}</p>` : '',
    ].filter(Boolean).join('')

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
  <div class="status">${statusParts.join('<span style="color:#ccc"> | </span>')}</div>
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
  ${order!.total_price != null ? `<div class="order-total">Order total: ${formatRub(order!.total_price)}</div>` : ''}
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
                {catalogItem?.image_url
                  ? <img src={catalogItem.image_url} alt="" className="size-8 shrink-0 rounded object-cover" loading="lazy" />
                  : <div className="size-8 shrink-0 rounded bg-gray-100" />
                }
                <div className="min-w-0 flex-1">
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

      <div className="print:hidden">
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
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete order
        </button>
      </div>

      <Modal title="Add item" open={addingLine} onClose={() => setAddingLine(false)}>
        <form onSubmit={addLine}>
          <Field label="From catalog">
            <CatalogPicker
              catalog={catalog ?? []}
              value={lineForm.item_id}
              onSelect={(id) => {
                const picked = itemNames.get(id)
                setLineForm({
                  ...lineForm,
                  item_id: id,
                  unit_price: picked?.sale_price?.toString() ?? lineForm.unit_price,
                })
              }}
            />
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
