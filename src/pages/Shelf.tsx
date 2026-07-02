import { useMemo, useState } from 'react'
import type { Expense, ShelfItem } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const EMPTY = { name: '', price: '', month: '', qty_sent: '', qty_sold: '' }

export default function Shelf() {
  const { data: rows, isLoading, isError, refetch } = useList<ShelfItem>('shelf_items', { orderBy: 'name' })
  const insert = useInsert<ShelfItem>('shelf_items')
  const update = useUpdate<ShelfItem>('shelf_items')
  const remove = useDelete('shelf_items')
  const insertExpense = useInsert<Expense>('expenses', ['expense_feed'])

  const [month, setMonth] = useState<string>('all')
  const [editing, setEditing] = useState<ShelfItem | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [rentLogged, setRentLogged] = useState(false)

  const months = useMemo(() => {
    const set = new Set((rows ?? []).map((r) => r.month).filter((m): m is string => Boolean(m)))
    return Array.from(set).sort().reverse()
  }, [rows])

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => month === 'all' || r.month === month),
    [rows, month],
  )

  const totals = useMemo(
    () => ({
      sent: filtered.reduce((s, r) => s + (r.qty_sent ?? 0), 0),
      sold: filtered.reduce((s, r) => s + (r.qty_sold ?? 0), 0),
      income: filtered.reduce((s, r) => s + (r.income ?? 0), 0),
    }),
    [filtered],
  )

  function openEditor(r: ShelfItem | 'new') {
    setEditing(r)
    if (r === 'new') setForm({ ...EMPTY, month: month !== 'all' ? month : new Date().toISOString().slice(0, 7) })
    else
      setForm({
        name: r.name,
        price: r.price?.toString() ?? '',
        month: r.month ?? '',
        qty_sent: r.qty_sent?.toString() ?? '',
        qty_sold: r.qty_sold?.toString() ?? '',
      })
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const values = {
      name: form.name,
      price: form.price === '' ? null : Number(form.price),
      month: form.month || null,
      qty_sent: form.qty_sent === '' ? 0 : Number(form.qty_sent),
      qty_sold: form.qty_sold === '' ? 0 : Number(form.qty_sold),
    }
    if (editing === 'new') insert.mutate(values, { onSuccess: () => setEditing(null) })
    else if (editing) update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })
  }

  function logRent() {
    const m = month !== 'all' ? month : new Date().toISOString().slice(0, 7)
    const raw = prompt(`Shelf rent amount for ${m} (₽):`, '1500')
    if (!raw) return
    const amount = Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid amount, e.g. 1500.')
      return
    }
    insertExpense.mutate(
      {
        date: `${m}-01`,
        category: 'shelf_rent',
        description: `Shelf rent ${m}`,
        amount,
      },
      { onSuccess: () => setRentLogged(true) },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Shelf</h1>
        <button onClick={() => openEditor('new')} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          + Add position
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} !w-auto`}>
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={logRent} className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50">
          {rentLogged ? '✓ Rent logged' : 'Log rent'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold">{totals.sent}</p>
          <p className="text-xs text-gray-500">sent</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold">{totals.sold}</p>
          <p className="text-xs text-gray-500">sold</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold">{formatRub(totals.income)}</p>
          <p className="text-xs text-gray-500">income</p>
        </div>
      </div>

      {isLoading && <EmptyState message="Loading…" />}
      {isError && <EmptyState message="Failed to load shelf." onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && <EmptyState message="No shelf positions yet." />}

      <div className="space-y-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => openEditor(r)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-sm hover:bg-violet-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-xs text-gray-500">
                {r.month ?? '—'} · sent {r.qty_sent ?? 0} · sold {r.qty_sold ?? 0} · left {r.qty_remaining ?? 0}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold">{formatRub(r.price)}</p>
              <p className="text-xs text-green-700">{formatRub(r.income)}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal title={editing === 'new' ? 'Add position' : 'Edit position'} open={editing !== null} onClose={() => setEditing(null)}>
        <form onSubmit={save}>
          <Field label="Name">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Month">
              <input className={inputClass} type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </Field>
            <Field label="Qty sent">
              <input className={inputClass} type="number" inputMode="numeric" value={form.qty_sent} onChange={(e) => setForm({ ...form, qty_sent: e.target.value })} />
            </Field>
            <Field label="Qty sold">
              <input className={inputClass} type="number" inputMode="numeric" value={form.qty_sold} onChange={(e) => setForm({ ...form, qty_sold: e.target.value })} />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editing !== 'new' && editing && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this position?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
              }}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </form>
      </Modal>
    </div>
  )
}
