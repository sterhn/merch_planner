import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Order } from '../lib/types'
import { useInsert, useList } from '../hooks/useTable'
import { formatRub } from '../lib/format'
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
        <h1 className="text-xl font-bold">Orders</h1>
        <button onClick={() => setAdding(true)} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          + New order
        </button>
      </div>

      <input placeholder="Search telegram or email…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} mb-3`} />

      <div className="mb-4 flex gap-2 overflow-x-auto">
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
