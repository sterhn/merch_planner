import { useMemo, useState } from 'react'
import { Plus, Store, Check, ReceiptText, Loader2 } from 'lucide-react'
import type { Expense, ShelfItem } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import AnimatedNumber from '../components/AnimatedNumber'
import { DangerButton, Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

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
      className={`tap flex w-full items-center justify-between gap-3 rounded-card bg-surface p-3.5 text-left shadow-card hover:bg-brand/10 ${isInactive ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${isInactive ? 'text-ink-faint' : 'text-ink'}`}>{r.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-ink-faint">{r.month ?? '—'}</p>
          {sent > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-good" style={{ width: `${sellRate}%` }} />
              </div>
              <span className="text-[11px] text-ink-faint">{sellRate}%</span>
            </div>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          sent {sent} ·{' '}
          <span className={sold > 0 ? 'font-bold text-good' : 'text-ink-faint'}>sold {sold}</span>
          {' '}· left {remaining}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-sm">{formatRub(r.price)}</p>
        {(r.income ?? 0) > 0 && <p className="text-xs font-bold text-good">{formatRub(r.income)}</p>}
      </div>
    </button>
  )
}

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
        <h1 className="font-display text-2xl">Shelf</h1>
        <button
          onClick={() => {
            haptic()
            openEditor('new')
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          Add position
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
        <button
          onClick={logRent}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full border-2 border-brand/40 px-4 text-sm font-bold text-brand hover:bg-brand/10"
        >
          {rentLogged ? <Check size={15} strokeWidth={3} /> : <ReceiptText size={15} />}
          {rentLogged ? 'Rent logged' : 'Log rent'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-card border-l-4 border-l-brand bg-surface p-3 shadow-card">
          <p className="font-display text-base text-brand">
            <AnimatedNumber value={totals.sent} />
          </p>
          <p className="text-xs text-ink-faint">sent</p>
        </div>
        <div className="rounded-card border-l-4 border-l-good bg-surface p-3 shadow-card">
          <p className="font-display text-base text-good">
            <AnimatedNumber value={totals.sold} />
          </p>
          <p className="text-xs text-ink-faint">sold</p>
        </div>
        <div className="rounded-card border-l-4 border-l-good bg-surface p-3 shadow-card">
          <p className="font-display text-base text-good">
            <AnimatedNumber value={totals.income} format={formatRub} />
          </p>
          <p className="text-xs text-ink-faint">income</p>
        </div>
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {isError && <EmptyState icon={Store} message="Failed to load shelf." onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && <EmptyState icon={Store} message="No shelf positions yet." />}

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
            <div className="mt-2">
              <DangerButton
                type="button"
                onClick={() => {
                  if (confirm('Delete this position?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
                }}
              >
                Delete
              </DangerButton>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
