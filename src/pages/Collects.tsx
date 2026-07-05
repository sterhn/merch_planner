import { useState } from 'react'
import { Plus, Printer, AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'
import type { Collect } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { DangerButton, Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { name: '', vendor: '', qty: '', print_cost: '', commission: '', delivery_cost: '', deadline: '', paid: false }

export default function Collects() {
  const { data: collects, isLoading } = useList<Collect>('collects', { orderBy: 'deadline', ascending: false })
  const insert = useInsert<Collect>('collects', ['expense_feed'])
  const update = useUpdate<Collect>('collects', ['expense_feed'])
  const remove = useDelete('collects', ['expense_feed'])

  const [editing, setEditing] = useState<Collect | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)

  function openEditor(c: Collect | 'new') {
    setEditing(c)
    if (c === 'new') setForm(EMPTY)
    else
      setForm({
        name: c.name ?? '',
        vendor: c.vendor ?? '',
        qty: c.qty?.toString() ?? '',
        print_cost: c.print_cost?.toString() ?? '',
        commission: c.commission?.toString() ?? '',
        delivery_cost: c.delivery_cost?.toString() ?? '',
        deadline: c.deadline ?? '',
        paid: c.paid,
      })
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const values = {
      name: form.name || null,
      vendor: form.vendor || null,
      qty: form.qty === '' ? null : Number(form.qty),
      print_cost: form.print_cost === '' ? 0 : Number(form.print_cost),
      commission: form.commission === '' ? 0 : Number(form.commission),
      delivery_cost: form.delivery_cost === '' ? 0 : Number(form.delivery_cost),
      deadline: form.deadline || null,
      paid: form.paid,
    }
    if (editing === 'new') insert.mutate(values, { onSuccess: () => setEditing(null) })
    else if (editing) update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Collects</h1>
        <button
          onClick={() => {
            haptic()
            openEditor('new')
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          Add collect
        </button>
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {!isLoading && (collects ?? []).length === 0 && <EmptyState icon={Printer} message="No production runs yet." />}

      <div className="space-y-2">
        {(collects ?? []).map((c) => {
          const overdue = !c.paid && c.deadline != null && c.deadline < today
          return (
            <button
              key={c.id}
              onClick={() => openEditor(c)}
              className={`tap flex w-full items-center justify-between gap-3 rounded-card bg-surface p-3.5 text-left shadow-card hover:bg-brand/10 ${
                overdue ? 'ring-2 ring-bad/50' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{c.name ?? '—'}</p>
                <p className="text-xs text-ink-muted">
                  {c.vendor ?? '—'} · {c.qty ?? '?'} pcs · {formatRub(c.cost_per_unit)}/pc
                </p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    overdue ? 'bg-bad/10 text-bad' : 'bg-surface-2 text-ink-muted'
                  }`}
                >
                  {overdue ? <AlertTriangle size={12} /> : <CalendarClock size={12} />}
                  {formatDate(c.deadline)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 font-display text-sm">{formatRub(c.total_cost)}</p>
                <StatusBadge on={c.paid} label="paid" />
              </div>
            </button>
          )
        })}
      </div>

      <Modal title={editing === 'new' ? 'Add collect' : 'Edit collect'} open={editing !== null} onClose={() => setEditing(null)}>
        <form onSubmit={save}>
          <Field label="What's printed">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Collect / vendor">
            <input className={inputClass} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input className={inputClass} type="number" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            </Field>
            <Field label="Print cost ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.print_cost} onChange={(e) => setForm({ ...form, print_cost: e.target.value })} />
            </Field>
            <Field label="Commission ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
            </Field>
            <Field label="Delivery ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.delivery_cost} onChange={(e) => setForm({ ...form, delivery_cost: e.target.value })} />
            </Field>
          </div>
          <Field label="Deadline">
            <input className={inputClass} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <label className="mb-4 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-violet-600"
              checked={form.paid}
              onChange={(e) => setForm({ ...form, paid: e.target.checked })}
            />
            Paid
          </label>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editing !== 'new' && editing && (
            <div className="mt-2">
              <DangerButton
                type="button"
                onClick={() => {
                  if (confirm('Delete this collect?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
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
