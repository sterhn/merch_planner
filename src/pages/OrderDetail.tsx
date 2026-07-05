import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Item, Order, OrderItem } from '../lib/types'
import { DELIVERY_METHODS } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { DangerButton, Field, inputClass, PrimaryButton, textareaClass } from '../components/FormField'

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
    <form onSubmit={submit} className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="mb-3 font-display text-sm text-ink-muted">Details</h2>
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
        <textarea className={textareaClass} rows={3} value={form.delivery_details} onChange={(e) => setForm({ ...form, delivery_details: e.target.value })} />
      </Field>
      <Field label="Comment">
        <textarea className={textareaClass} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
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

  const itemNames = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of catalog ?? []) map.set(i.id, i)
    return map
  }, [catalog])

  const linesTotal = useMemo(
    () => (lines ?? []).reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0),
    [lines],
  )

  if (!order) return <p className="py-12 text-center text-sm text-ink-faint">Loading…</p>

  function invalidateDetail() {
    qc.invalidateQueries({ queryKey: ['orders', id] })
    qc.invalidateQueries({ queryKey: ['orders'] })
  }

  function toggle(flag: 'paid' | 'sent' | 'delivered') {
    updateOrder.mutate({ id: id!, values: { [flag]: !order![flag] } }, { onSuccess: invalidateDetail })
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

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="tap -ml-2 mb-3 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} />
        Back to orders
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-display text-xl">{order.telegram || order.customer_email || 'Order'}</h1>
        <span className="shrink-0 font-display text-lg">{formatRub(order.total_price)}</span>
      </div>

      <div className="mb-5 flex gap-2 *:flex-1">
        <StatusBadge on={order.paid} label="paid" onClick={() => toggle('paid')} />
        <StatusBadge on={order.sent} label="sent" onClick={() => toggle('sent')} />
        <StatusBadge on={order.delivered} label="delivered" onClick={() => toggle('delivered')} />
      </div>

      <section className="mb-6 rounded-card bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm text-ink-muted">Items</h2>
          <button
            onClick={() => setAddingLine(true)}
            className="tap flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-brand"
          >
            <Plus size={15} strokeWidth={3} />
            Add item
          </button>
        </div>
        {(lines ?? []).length === 0 && <p className="py-3 text-sm text-ink-faint">No items.</p>}
        <ul className="divide-y divide-line">
          {(lines ?? []).map((l) => {
            const catalogItem = l.item_id ? itemNames.get(l.item_id) : undefined
            return (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {catalogItem?.name ?? l.name_text ?? '—'}
                    {l.qty > 1 && <span className="text-ink-muted"> ×{l.qty}</span>}
                  </p>
                  {l.category && <p className="text-xs text-ink-faint">{l.category}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-sm font-semibold">{formatRub(l.unit_price)}</span>
                  <button
                    onClick={() => {
                      if (confirm('Remove this item?'))
                        deleteLine.mutate(l.id, {
                          onSuccess: () => qc.invalidateQueries({ queryKey: ['order_items', id] }),
                        })
                    }}
                    className="tap flex size-10 items-center justify-center rounded-full text-ink-faint hover:text-bad"
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {(lines ?? []).length > 0 && (
          <p className="mt-2 text-right font-display text-xs text-ink-muted">items total: {formatRub(linesTotal)}</p>
        )}
      </section>

      <HeaderForm
        key={`${order.id}-${order.created_at}`}
        order={order}
        pending={updateOrder.isPending}
        onSave={(values) => updateOrder.mutate({ id: id!, values }, { onSuccess: invalidateDetail })}
      />

      <div className="mt-4">
        <DangerButton
          onClick={() => {
            if (confirm('Delete this whole order?'))
              deleteOrder.mutate(id!, { onSuccess: () => navigate('/orders') })
          }}
        >
          Delete order
        </DangerButton>
      </div>

      <Modal title="Add item" open={addingLine} onClose={() => setAddingLine(false)}>
        <form onSubmit={addLine}>
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
              {(catalog ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatRub(i.sale_price)})
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
