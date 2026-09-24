import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trash2,
  Store,
  Package2,
  Truck,
  MoreHorizontal,
  Printer,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import type { Expense, ExpenseFeedRow } from '../lib/types'
import { EXPENSE_CATEGORIES } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { currentMonth, formatDate, formatMonth, formatRub, monthKey, monthRange, parseMoney, todayISO } from '../lib/format'
import { haptic } from '../lib/haptics'
import Modal from '../components/Modal'
import { useConfirm } from '../hooks/useConfirm'
import ExpenseChart, { type MonthTotal } from '../components/ExpenseChart'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SECTIONS } from '../components/sections'
import { TONE_BLOB } from '../components/tones'
import { useLaunchFlag } from '../hooks/useLaunchFlag'
import SwipeableRow from '../components/SwipeableRow'
import { AddButton, DangerButton, Field, IconButton, inputClass, PrimaryButton } from '../components/FormField'

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

// The shelf is archived: its rent stays readable on old rows, but isn't
// offered for new ones.
const NEW_CATEGORIES: readonly Expense['category'][] = EXPENSE_CATEGORIES.filter((c) => c !== 'shelf_rent')

export default function Expenses() {
  const { data: feed, isLoading, isError, refetch } = useList<ExpenseFeedRow>('expense_feed', { orderBy: 'date', ascending: false })
  const insert = useInsert<Expense>('expenses', ['expense_feed'])
  const update = useUpdate<Expense>('expenses', ['expense_feed'])
  const remove = useDelete('expenses', ['expense_feed'])
  const { confirm, element: confirmSheet } = useConfirm()

  const launchNew = useLaunchFlag()
  // The open sheet: 'new' to add, a manual feed row to edit, null when closed.
  const [editing, setEditing] = useState<ExpenseFeedRow | 'new' | null>(launchNew ? 'new' : null)
  // Date and category carry over from one new expense to the next — they tend
  // to be logged in batches, a receipt at a time. Editing an old row doesn't
  // disturb them.
  const [batch, setBatch] = useState({ date: todayISO(), category: 'other' as Expense['category'] })
  const [form, setForm] = useState({ ...batch, description: '', amount: '' })
  const [amountError, setAmountError] = useState<string | null>(null)

  const byMonth = useMemo(() => {
    const groups = new Map<string, { rows: ExpenseFeedRow[]; total: number }>()
    for (const row of feed ?? []) {
      const key = monthKey(row.date)
      let group = groups.get(key)
      if (!group) groups.set(key, (group = { rows: [], total: 0 }))
      group.rows.push(row)
      group.total += row.amount
    }
    return Array.from(groups.entries())
  }, [feed])

  // Full history as contiguous monthly totals (zero-filled gaps) for the chart.
  const monthlyTotals = useMemo<MonthTotal[]>(() => {
    if (!feed || feed.length === 0) return []
    const totals = new Map<string, number>()
    for (const row of feed) {
      const key = monthKey(row.date)
      totals.set(key, (totals.get(key) ?? 0) + row.amount)
    }
    const keys = Array.from(totals.keys()).sort()
    const last = keys[keys.length - 1] > currentMonth() ? keys[keys.length - 1] : currentMonth()
    return monthRange(keys[0], last).map((month) => ({ month, total: totals.get(month) ?? 0 }))
  }, [feed])

  // Shelf rent isn't offered for new expenses, but an old one being edited
  // keeps it — otherwise the select would quietly switch its category.
  const categoryOptions = NEW_CATEGORIES.includes(form.category) ? NEW_CATEGORIES : [...NEW_CATEGORIES, form.category]

  function openNew() {
    setForm({ ...batch, description: '', amount: '' })
    setAmountError(null)
    setEditing('new')
  }

  function openEdit(row: ExpenseFeedRow) {
    haptic()
    setForm({
      date: row.date,
      category: row.category as Expense['category'],
      description: row.description ?? '',
      amount: String(row.amount),
    })
    setAmountError(null)
    setEditing(row)
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    // Unreadable amounts used to be saved as 0 ₽.
    const amount = parseMoney(form.amount)
    if (amount === null) {
      setAmountError('Enter the amount as a number, like 1 500.')
      return
    }
    const values = {
      date: form.date,
      category: form.category,
      description: form.description.trim() || null,
      amount,
    }
    if (editing === 'new') {
      insert.mutate(values, {
        onSuccess: () => {
          setBatch({ date: form.date, category: form.category })
          setEditing(null)
        },
      })
    } else if (editing) {
      update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })
    }
  }

  function confirmDelete(id: string, then?: () => void) {
    confirm('Delete this expense?', () => remove.mutate(id, { onSuccess: then }))
  }

  return (
    <div>
      <PageHeader title="Expenses" icon={SECTIONS.expenses.icon} tone={SECTIONS.expenses.tone}>
        <AddButton onClick={openNew}>Add expense</AddButton>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={(feed ?? []).length === 0}
        icon={Receipt}
        tone={SECTIONS.expenses.tone}
        errorMessage="Failed to load expenses."
        emptyMessage="No expenses yet."
        onRetry={() => void refetch()}
      />

      {monthlyTotals.length > 0 && <ExpenseChart months={monthlyTotals} />}

      {byMonth.map(([month, { rows, total }]) => (
        <section key={month} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-base">{formatMonth(month)}</h2>
            <span className="font-display text-sm text-bad">−{formatRub(total)}</span>
          </div>
          <div className="space-y-2">
            {rows.map((row) => {
              const CategoryIcon = CATEGORY_ICONS[row.category] ?? MoreHorizontal
              const label = row.description || CATEGORY_LABELS[row.category] || row.category
              // Spans only: this sits inside a button (manual rows) or a link.
              const body = (
                <>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-[38%] ${TONE_BLOB[SECTIONS.expenses.tone]}`}>
                    <CategoryIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-ink-muted">
                      {formatDate(row.date)} · {CATEGORY_LABELS[row.category] ?? row.category}
                      {row.source === 'collect' && (
                        <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-3xs font-bold text-brand">
                          from collects
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-sm">{formatRub(row.amount)}</span>
                </>
              )
              // A collect's cost is edited on the collect itself.
              if (row.source === 'collect') {
                return (
                  <Link
                    key={`${row.source}-${row.id}`}
                    to="/collects"
                    className="lift flex items-center gap-3 rounded-card glass p-3.5"
                  >
                    {body}
                  </Link>
                )
              }
              return (
                // Swipe right to delete, as on the Orders list.
                <SwipeableRow
                  key={`${row.source}-${row.id}`}
                  left={{
                    icon: Trash2,
                    label: 'delete',
                    tone: 'bad',
                    onAction: () => confirmDelete(row.id),
                  }}
                >
                  <div className="flex items-center rounded-card glass pr-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="tap flex min-w-0 flex-1 items-center gap-3 p-3.5 pr-1 text-left"
                    >
                      {body}
                    </button>
                    <IconButton
                      icon={Trash2}
                      size={10}
                      tone="danger"
                      label={`Delete ${label}`}
                      onClick={() => confirmDelete(row.id)}
                    />
                  </div>
                </SwipeableRow>
              )
            })}
          </div>
        </section>
      ))}

      <Modal title={editing === 'new' ? 'Add expense' : 'Edit expense'} open={editing !== null} onClose={() => setEditing(null)}>
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
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {/* text + inputMode, not type="number": a number input rejects the comma
              decimal separator a Russian keyboard produces (parseMoney handles it). */}
          <Field label="Amount ₽">
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              required
              value={form.amount}
              onChange={(e) => {
                setForm({ ...form, amount: e.target.value })
                setAmountError(null)
              }}
            />
          </Field>
          {amountError && (
            <p role="alert" className="-mt-1 mb-3 text-sm font-semibold text-bad">
              {amountError}
            </p>
          )}
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editing !== 'new' && editing && (
            <div className="mt-2">
              <DangerButton type="button" onClick={() => confirmDelete(editing.id, () => setEditing(null))}>
                Delete
              </DangerButton>
            </div>
          )}
        </form>
      </Modal>

      {confirmSheet}
    </div>
  )
}
