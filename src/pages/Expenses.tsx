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
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import type { Expense, ExpenseFeedRow } from '../lib/types'
import { EXPENSE_CATEGORIES } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { currentMonth, formatDate, formatMonth, formatRub, monthKey, monthRange, parseMoney, todayISO } from '../lib/format'
import Modal from '../components/Modal'
import FilterChip from '../components/FilterChip'
import { useConfirm } from '../hooks/useConfirm'
import ExpenseChart, { type MonthTotal } from '../components/ExpenseChart'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SkeletonRows } from '../components/Skeleton'
import { SECTIONS } from '../components/sections'
import { useLaunchFlag } from '../hooks/useLaunchFlag'
import SwipeableRow from '../components/SwipeableRow'
import RevealMore from '../components/RevealMore'
import { useReveal } from '../hooks/useReveal'
import { AddButton, DangerButton, Field, IconButton, inputClass, PrimaryButton } from '../components/FormField'
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

// The shelf is archived: its rent stays readable on old rows, but isn't
// offered for new ones.
const NEW_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c !== 'shelf_rent')

export default function Expenses() {
  const { data: allRows, isLoading, isError, refetch } = useList<ExpenseFeedRow>('expense_feed', { orderBy: 'date', ascending: false })
  // One category at a time (or all): the chart, month totals and rows follow it.
  const [category, setCategory] = useState<string | null>(null)
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of allRows ?? []) counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [allRows])
  const feed = useMemo(
    () => (category ? (allRows ?? []).filter((r) => r.category === category) : allRows),
    [allRows, category],
  )
  const insert = useInsert<Expense>('expenses', ['expense_feed'])
  const update = useUpdate<Expense>('expenses', ['expense_feed'])
  const remove = useDelete('expenses', ['expense_feed'])
  const { confirm, element: confirmSheet } = useConfirm()

  const launchNew = useLaunchFlag()
  // 'new', or the manual expense being edited.
  const [editing, setEditing] = useState<ExpenseFeedRow | 'new' | null>(launchNew ? 'new' : null)
  // The add form keeps date and category between entries (see save); editing
  // borrows the form and puts the draft back when it's done.
  const [form, setForm] = useState({
    date: todayISO(),
    category: 'other' as Expense['category'],
    description: '',
    amount: '',
  })
  const [addDraft, setAddDraft] = useState(form)

  function openAdd() {
    setForm(addDraft)
    setEditing('new')
  }

  function openEdit(row: ExpenseFeedRow) {
    haptic()
    if (editing === null || editing === 'new') setAddDraft(form)
    setForm({
      date: row.date,
      category: row.category as Expense['category'],
      description: row.description ?? '',
      amount: String(row.amount),
    })
    setEditing(row)
  }

  function closeEditor() {
    if (editing !== 'new') setForm(addDraft)
    setEditing(null)
  }

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

  // Month totals come from every row; only the rows themselves are revealed
  // a batch at a time.
  const reveal = useReveal((feed ?? []).length, category ?? 'all')
  const visibleMonths = useMemo(() => {
    let budget = reveal.limit
    const out: [string, { rows: ExpenseFeedRow[]; total: number }][] = []
    for (const [month, group] of byMonth) {
      if (budget <= 0) break
      out.push([month, { ...group, rows: group.rows.slice(0, budget) }])
      budget -= group.rows.length
    }
    return out
  }, [byMonth, reveal.limit])

  function save(e: React.FormEvent) {
    e.preventDefault()
    const values = {
      date: form.date,
      category: form.category,
      description: form.description || null,
      amount: parseMoney(form.amount) ?? 0,
    }
    if (editing !== null && editing !== 'new') {
      update.mutate({ id: editing.id, values }, { onSuccess: closeEditor })
      return
    }
    insert.mutate(values, {
      onSuccess: () => {
        setEditing(null)
        // Keep date and category — expenses tend to be logged in batches
        // (a receipt at a time) — but never reopen on the last amount.
        const next = { ...form, description: '', amount: '' }
        setForm(next)
        setAddDraft(next)
      },
    })
  }

  const editingRow = editing !== null && editing !== 'new' ? editing : null
  // The archived shelf's rent isn't offered for new rows, but an old one being
  // edited keeps its category.
  const categoryOptions: readonly Expense['category'][] =
    editingRow && !(NEW_CATEGORIES as readonly string[]).includes(form.category)
      ? [form.category, ...NEW_CATEGORIES]
      : NEW_CATEGORIES

  function confirmDelete(id: string) {
    confirm('Delete this expense?', () => remove.mutate(id))
  }

  return (
    <div>
      <PageHeader title="Expenses" icon={SECTIONS.expenses.icon} tone={SECTIONS.expenses.tone}>
        <AddButton onClick={openAdd} data-shortcut="new" title="Shortcut: N">Add expense</AddButton>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={(allRows ?? []).length === 0}
        icon={Receipt}
        tone={SECTIONS.expenses.tone}
        skeleton={<SkeletonRows rows={5} />}
        errorMessage="Failed to load expenses."
        emptyMessage="No expenses yet."
        onRetry={() => void refetch()}
      />

      {categories.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Category">
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            All
          </FilterChip>
          {categories.map(([c, n]) => (
            <FilterChip key={c} active={category === c} count={n} onClick={() => setCategory(category === c ? null : c)}>
              {CATEGORY_LABELS[c] ?? c}
            </FilterChip>
          ))}
        </div>
      )}

      {monthlyTotals.length > 0 && <ExpenseChart months={monthlyTotals} />}

      {visibleMonths.map(([month, { rows, total }]) => (
        <section key={month} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-base">{formatMonth(month)}</h2>
            <span className="glass rounded-full px-3 py-0.5 font-display text-sm text-bad">−{formatRub(total)}</span>
          </div>
          <div className="space-y-2">
            {rows.map((row) => {
              const CategoryIcon = CATEGORY_ICONS[row.category] ?? MoreHorizontal
              const label = row.description || CATEGORY_LABELS[row.category] || row.category
              const body = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[38%] bg-peach/15 text-peach">
                    <CategoryIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{label}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(row.date)} · {CATEGORY_LABELS[row.category] ?? row.category}
                      {row.source === 'collect' && (
                        <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-3xs font-bold text-brand">
                          from collects
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm">{formatRub(row.amount)}</span>
                </>
              )
              // Collect costs are edited on the collect itself — the row links there.
              if (row.source === 'collect') {
                return (
                  <Link
                    key={`${row.source}-${row.id}`}
                    to={`/collects?open=${row.id}`}
                    className="lift flex items-center gap-3 rounded-card glass p-3.5"
                  >
                    {body}
                    <ChevronRight size={16} className="-mr-1 shrink-0 text-ink-faint" />
                  </Link>
                )
              }
              return (
                <SwipeableRow
                  key={`${row.source}-${row.id}`}
                  right={{
                    icon: Trash2,
                    label: 'delete',
                    tone: 'bad',
                    onAction: () => confirmDelete(row.id),
                  }}
                >
                  <div className="flex items-center rounded-card glass">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="tap flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left"
                    >
                      <span className="sr-only">Edit </span>
                      {body}
                    </button>
                    {/* SwipeableRow ignores mouse pointers, so desktop needs a visible delete. */}
                    <IconButton
                      icon={Trash2}
                      size={10}
                      tone="danger"
                      label={`Delete ${label}`}
                      className="mr-2 hidden md:grid"
                      onClick={() => confirmDelete(row.id)}
                    />
                  </div>
                </SwipeableRow>
              )
            })}
          </div>
        </section>
      ))}

      {reveal.hasMore && <RevealMore onReveal={reveal.more} remaining={(feed ?? []).length - reveal.limit} />}

      <Modal title={editingRow ? 'Edit expense' : 'Add expense'} open={editing !== null} onClose={closeEditor}>
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
            <input className={inputClass} type="text" inputMode="decimal" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editingRow && (
            <div className="mt-2">
              <DangerButton
                onClick={() =>
                  confirm('Delete this expense?', () => remove.mutate(editingRow.id, { onSuccess: closeEditor }))
                }
              >
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
