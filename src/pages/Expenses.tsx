import { useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Store,
  Package2,
  Truck,
  MoreHorizontal,
  Printer,
  Receipt,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import type { Expense, ExpenseFeedRow } from '../lib/types'
import { EXPENSE_CATEGORIES } from '../lib/types'
import { useDelete, useInsert, useList } from '../hooks/useTable'
import { formatDate, formatRub, monthKey, todayISO } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import SwipeableRow from '../components/SwipeableRow'
import { Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

const CATEGORY_LABELS: Record<string, string> = {
  shelf_rent: 'Shelf rent',
  supplies: 'Supplies',
  shipping: 'Shipping',
  other: 'Other',
  collect: 'Collect',
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  shelf_rent: Store,
  supplies: Package2,
  shipping: Truck,
  other: MoreHorizontal,
  collect: Printer,
}

export default function Expenses() {
  const { data: feed, isLoading, isError, refetch } = useList<ExpenseFeedRow>('expense_feed', { orderBy: 'date', ascending: false })
  const insert = useInsert<Expense>('expenses', ['expense_feed'])
  const remove = useDelete('expenses', ['expense_feed'])

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    date: todayISO(),
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

  function confirmDelete(id: string) {
    if (confirm('Delete this expense?')) {
      haptic([10, 30, 10])
      remove.mutate(id)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Expenses</h1>
        <button
          onClick={() => {
            haptic()
            setAdding(true)
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          Add expense
        </button>
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {isError && <EmptyState icon={Receipt} message="Failed to load expenses." onRetry={() => refetch()} />}
      {!isLoading && !isError && (feed ?? []).length === 0 && <EmptyState icon={Receipt} message="No expenses yet." />}

      {byMonth.map(([month, rows]) => (
        <section key={month} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-sm text-ink-muted">{month}</h2>
            <span className="font-display text-sm text-bad">
              −{formatRub(rows.reduce((s, r) => s + r.amount, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {rows.map((row) => {
              const CategoryIcon = CATEGORY_ICONS[row.category] ?? MoreHorizontal
              const content = (
                <div className="flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-card">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <CategoryIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {row.description || CATEGORY_LABELS[row.category] || row.category}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(row.date)} · {CATEGORY_LABELS[row.category] ?? row.category}
                      {row.source === 'collect' && (
                        <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                          from collects
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-display text-sm">{formatRub(row.amount)}</span>
                    {row.source === 'manual' && (
                      <button
                        onClick={() => confirmDelete(row.id)}
                        className="tap flex size-10 items-center justify-center rounded-full text-ink-faint hover:text-bad"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
              return row.source === 'manual' ? (
                <SwipeableRow
                  key={`${row.source}-${row.id}`}
                  right={{
                    icon: Trash2,
                    label: 'delete',
                    className: 'bg-bad',
                    onAction: () => confirmDelete(row.id),
                  }}
                >
                  {content}
                </SwipeableRow>
              ) : (
                <div key={`${row.source}-${row.id}`}>{content}</div>
              )
            })}
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
