import { useState } from 'react'
import type { Collect } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const EMPTY = { name: '', vendor: '', qty: '', print_cost: '', commission: '', delivery_cost: '', deadline: '', paid: false }

export default function Collects() {
  const { data: collects, isLoading, isError, refetch } = useList<Collect>('collects', { orderBy: 'deadline', ascending: false })
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
        <h1 className="text-xl font-bold">Collects</h1>
        <button onClick={() => openEditor('new')} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          + Add collect
        </button>
      </div>

      {isLoading && <EmptyState message="Loading…" />}
      {isError && <EmptyState message="Failed to load collects." onRetry={() => refetch()} />}
      {!isLoading && !isError && (collects ?? []).length === 0 && <EmptyState message="No production runs yet." />}

      <div className="space-y-2">
        {(collects ?? []).map((c) => {
          const overdue = !c.paid && c.deadline != null && c.deadline < today
          return (
            <button
              key={c.id}
              onClick={() => openEditor(c)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-sm hover:bg-violet-50 ${
                overdue ? 'ring-1 ring-red-300' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name ?? '—'}</p>
                <p className="text-xs text-gray-500">
                  {c.vendor ?? '—'} · {c.qty ?? '?'} pcs · {formatRub(c.cost_per_unit)}/pc
                </p>
                <p className={`text-xs ${overdue ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                  deadline {formatDate(c.deadline)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">{formatRub(c.total_cost)}</p>
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
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
            Paid
          </label>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editing !== 'new' && editing && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this collect?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
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
