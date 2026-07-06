import { useMemo, useState } from 'react'
import type { Expense, ShelfItem } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const EMPTY = { name: '', price: '', month: '', qty_sent: '', qty_sold: '' }

function ShelfRow({ r, onClick }: { r: ShelfItem; onClick: () => void }) {
  const sold = r.qty_sold ?? 0
  const sent = r.qty_sent ?? 0
  const remaining = r.qty_remaining ?? 0
  const isInactive = sold === 0 && sent === 0
  const sellRate = sent > 0 ? Math.round((sold / sent) * 100) : 0

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition-colors hover:bg-violet-50 ${isInactive ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isInactive ? 'text-gray-400' : 'text-gray-900'}`}>{r.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-gray-400">{r.month ?? '—'}</p>
          {sent > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${sellRate}%` }} />
              </div>
              <span className="text-[11px] text-gray-400">{sellRate}%</span>
            </div>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          sent {sent} ·{' '}
          <span className={sold > 0 ? 'font-semibold text-emerald-600' : 'text-gray-400'}>sold {sold}</span> · left{' '}
          {remaining}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-800">{formatRub(r.price)}</p>
        {(r.income ?? 0) > 0 && <p className="text-xs font-medium text-emerald-600">{formatRub(r.income)}</p>}
      </div>
    </button>
  )
}

export default function Shelf() {
  const { data: rows, isLoading } = useList<ShelfItem>('shelf_items', { orderBy: 'name' })
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
    const amount = prompt(`Shelf rent amount for ${m} (₽):`, '1500')
    if (!amount) return
    insertExpense.mutate(
      {
        date: `${m}-01`,
        category: 'shelf_rent',
        description: `Shelf rent ${m}`,
        amount: Number(amount),
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
          <p className="text-xs text-gray-400">sent</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-emerald-600">{totals.sold}</p>
          <p className="text-xs text-gray-400">sold</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-violet-700">{formatRub(totals.income)}</p>
          <p className="text-xs text-gray-400">income</p>
        </div>
      </div>

      {isLoading && <EmptyState message="Loading…" />}
      {!isLoading && filtered.length === 0 && <EmptyState message="No shelf positions yet." />}

      <div className="space-y-2">
        {filtered.map((r) => (
          <ShelfRow key={r.id} r={r} onClick={() => openEditor(r)} />
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
