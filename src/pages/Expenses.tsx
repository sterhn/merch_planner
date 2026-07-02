import { useMemo, useState } from 'react'
import type { Expense, ExpenseFeedRow } from '../lib/types'
import { EXPENSE_CATEGORIES } from '../lib/types'
import { useDelete, useInsert, useList } from '../hooks/useTable'
import { formatDate, formatRub, monthKey } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const CATEGORY_LABELS: Record<string, string> = {
  shelf_rent: 'Shelf rent',
  supplies: 'Supplies',
  shipping: 'Shipping',
  other: 'Other',
  collect: 'Collect',
}

export default function Expenses() {
  const { data: feed, isLoading, isError, refetch } = useList<ExpenseFeedRow>('expense_feed', { orderBy: 'date', ascending: false })
  const insert = useInsert<Expense>('expenses', ['expense_feed'])
  const remove = useDelete('expenses', ['expense_feed'])

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'other' as Expense['category'],
    description: '',
    amount: '',
  })

  const byMonth = useMemo(() => {
    const groups = new Map<string, ExpenseFeedRow[]>()
    for (const row of feed ?? []) {
      const key = monthKey(row.date)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }
    return Array.from(groups.entries())
  }, [feed])

  function save(e: React.FormEvent) {
    e.preventDefault()
    insert.mutate(
      {
        date: form.date,
        category: form.category,
        description: form.description || null,
        amount: Number(form.amount),
      },
      { onSuccess: () => setAdding(false) },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Expenses</h1>
        <button onClick={() => setAdding(true)} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          + Add expense
        </button>
      </div>

      {isLoading && <EmptyState message="Loading…" />}
      {isError && <EmptyState message="Failed to load expenses." onRetry={() => refetch()} />}
      {!isLoading && !isError && (feed ?? []).length === 0 && <EmptyState message="No expenses yet." />}

      {byMonth.map(([month, rows]) => (
        <section key={month} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-600">{month}</h2>
            <span className="text-sm font-bold text-red-600">
              −{formatRub(rows.reduce((s, r) => s + r.amount, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={`${row.source}-${row.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.description || CATEGORY_LABELS[row.category] || row.category}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(row.date)} · {CATEGORY_LABELS[row.category] ?? row.category}
                    {row.source === 'collect' && (
                      <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        from collects
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{formatRub(row.amount)}</span>
                  {row.source === 'manual' && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this expense?')) remove.mutate(row.id)
                      }}
                      className="rounded p-1 text-gray-400 hover:text-red-600"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Modal title="Add expense" open={adding} onClose={() => setAdding(false)}>
        <form onSubmit={save}>
          <Field label="Date">
            <input className={inputClass} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Expense['category'] })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Amount ₽">
            <input className={inputClass} type="number" step="0.01" inputMode="decimal" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <PrimaryButton type="submit" disabled={insert.isPending}>
            Save
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}
