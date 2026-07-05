import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, PackageOpen, BadgeCheck, Trash2, Loader2 } from 'lucide-react'
import type { Order } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import SwipeableRow from '../components/SwipeableRow'
import { Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

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
  const update = useUpdate<Order>('orders')
  const remove = useDelete('orders')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ telegram: '', customer_email: '' })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (orders ?? []).filter((o) => {
      if (q && !`${o.telegram ?? ''} ${o.customer_email ?? ''}`.toLowerCase().includes(q)) return false
      if (filter === 'unpaid') return !o.paid
      if (filter === 'to_send') return o.paid && !o.sent
      if (filter === 'done') return o.delivered
      return true
    })
  }, [orders, search, filter])

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
        <button
          onClick={() => {
            haptic()
            setAdding(true)
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          New order
        </button>
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

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              haptic(5)
              setFilter(f.key)
            }}
            className={`tap h-9 shrink-0 rounded-full px-4 text-xs font-bold ${
              filter === f.key
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-card'
                : 'bg-surface text-ink-muted shadow-card'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {!isLoading && filtered.length === 0 && (
        <EmptyState icon={PackageOpen} message="No orders found." hint="Swipe a row to mark paid or delete." />
      )}

      <div className="space-y-2">
        {filtered.map((o) => (
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
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{o.telegram || o.customer_email || 'no contact'}</p>
                <p className="truncate text-xs text-ink-muted">{o.delivery_method ?? 'no delivery method'}</p>
                <div className="mt-1.5 flex gap-1">
                  <StatusBadge on={o.paid} label="paid" />
                  <StatusBadge on={o.sent} label="sent" />
                  <StatusBadge on={o.delivered} label="delivered" />
                </div>
              </div>
              <span className="shrink-0 font-display text-sm">{formatRub(o.total_price)}</span>
            </Link>
          </SwipeableRow>
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
          <p className="mb-3 text-xs text-ink-muted">You can add items and details on the next screen.</p>
          <PrimaryButton type="submit" disabled={insert.isPending}>
            Create
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}
