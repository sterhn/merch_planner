import { useMemo, useState } from 'react'
import { Plus, Printer, AlertTriangle, CalendarClock, Loader2, PackageCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Collect, CollectItem, Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { supabase } from '../lib/supabase'
import { formatDate, formatRub, todayISO } from '../lib/format'
import { showToast } from '../lib/toast'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { DangerButton, Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { name: '', vendor: '', qty: '', print_cost: '', commission: '', delivery_cost: '', deadline: '', paid: false }

interface PositionRow {
  item_id: string
  name_text: string
  qty: string
}

export default function Collects() {
  const { data: collects, isLoading, isError, refetch } = useList<Collect>('collects', { orderBy: 'deadline', ascending: false })
  const { data: collectItems } = useList<CollectItem>('collect_items')
  const { data: items } = useList<Item>('items', { orderBy: 'name' })
  const insert = useInsert<Collect>('collects', ['expense_feed'])
  const update = useUpdate<Collect>('collects', ['expense_feed'])
  const remove = useDelete('collects', ['expense_feed'])
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<Collect | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [receiveBusy, setReceiveBusy] = useState(false)

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items ?? []) m.set(i.id, i)
    return m
  }, [items])

  const positionsByCollect = useMemo(() => {
    const m = new Map<string, CollectItem[]>()
    for (const r of collectItems ?? []) {
      const arr = m.get(r.collect_id) ?? []
      arr.push(r)
      m.set(r.collect_id, arr)
    }
    return m
  }, [collectItems])

  function positionLabel(p: CollectItem): string {
    const name = (p.item_id ? itemById.get(p.item_id)?.name : null) ?? p.name_text ?? '—'
    return p.qty > 1 ? `${name} ×${p.qty}` : name
  }

  function openEditor(c: Collect | 'new') {
    setEditing(c)
    setFormError(null)
    if (c === 'new') {
      setForm(EMPTY)
      setPositions([])
    } else {
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
      setPositions(
        (positionsByCollect.get(c.id) ?? []).map((p) => ({
          item_id: p.item_id ?? '',
          name_text: p.name_text ?? '',
          qty: String(p.qty),
        })),
      )
    }
  }

  function cleanPositions() {
    return positions
      .filter((p) => p.item_id || p.name_text.trim())
      .map((p) => ({
        item_id: p.item_id || null,
        name_text: p.item_id ? null : p.name_text.trim(),
        qty: Math.max(1, Math.round(Number(p.qty)) || 1),
      }))
  }

  // Replaces the collect's positions with the editor rows. No-op for collects
  // that never had positions.
  async function syncPositions(collectId: string) {
    const rows = cleanPositions().map((p) => ({ ...p, collect_id: collectId }))
    if (rows.length === 0 && !(collectItems ?? []).some((r) => r.collect_id === collectId)) return
    const { error: delError } = await supabase.from('collect_items').delete().eq('collect_id', collectId)
    if (delError) throw delError
    if (rows.length > 0) {
      const { error } = await supabase.from('collect_items').insert(rows)
      if (error) throw error
    }
    await queryClient.invalidateQueries({ queryKey: ['collect_items'] })
  }

  // Saves the collect + positions; returns the saved collect or null on failure.
  async function doSave(): Promise<Collect | null> {
    setFormError(null)
    const posQty = cleanPositions().reduce((s, p) => s + p.qty, 0)
    const values = {
      name: form.name || null,
      vendor: form.vendor || null,
      // Total quantity falls back to the sum of positions so cost-per-unit works.
      qty: form.qty !== '' ? Number(form.qty) : posQty > 0 ? posQty : null,
      print_cost: form.print_cost === '' ? 0 : Number(form.print_cost),
      commission: form.commission === '' ? 0 : Number(form.commission),
      delivery_cost: form.delivery_cost === '' ? 0 : Number(form.delivery_cost),
      deadline: form.deadline || null,
      paid: form.paid,
    }
    try {
      let saved: Collect
      if (editing === 'new') {
        saved = await insert.mutateAsync(values)
        // If the position sync below fails, a retry must update, not re-insert.
        setEditing(saved)
      } else if (editing) {
        await update.mutateAsync({ id: editing.id, values })
        saved = { ...editing, ...values }
      } else {
        return null
      }
      await syncPositions(saved.id)
      return saved
    } catch {
      setFormError('Save failed — check your connection and try again.')
      return null
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    void doSave().then((saved) => {
      if (saved) setEditing(null)
    })
  }

  // The collect arrived: bump stock for linked items, turn free-text positions
  // into new catalog items (cost = this collect's per-unit cost), and stamp
  // received_at so it can't be applied twice.
  async function receive() {
    const saved = await doSave()
    if (!saved) return
    setReceiveBusy(true)
    try {
      const totalCost =
        (Number(form.print_cost) || 0) + (Number(form.commission) || 0) + (Number(form.delivery_cost) || 0)
      const qtyTotal = form.qty !== '' ? Number(form.qty) : cleanPositions().reduce((s, p) => s + p.qty, 0)
      const costPerUnit = qtyTotal > 0 ? Math.round((totalCost / qtyTotal) * 100) / 100 : null

      const { data: rows, error } = await supabase.from('collect_items').select('*').eq('collect_id', saved.id)
      if (error) throw error
      for (const r of (rows ?? []) as CollectItem[]) {
        if (r.item_id) {
          const { data: cur, error: curErr } = await supabase.from('items').select('stock_qty').eq('id', r.item_id).single()
          if (curErr) throw curErr
          const { error: updErr } = await supabase
            .from('items')
            .update({ stock_qty: (cur?.stock_qty ?? 0) + r.qty })
            .eq('id', r.item_id)
          if (updErr) throw updErr
        } else if (r.name_text) {
          const { data: created, error: insErr } = await supabase
            .from('items')
            .insert({ name: r.name_text, cost_price: costPerUnit, stock_qty: r.qty })
            .select('id')
            .single()
          if (insErr) throw insErr
          const { error: linkErr } = await supabase.from('collect_items').update({ item_id: created.id }).eq('id', r.id)
          if (linkErr) throw linkErr
        }
      }
      const { error: recvErr } = await supabase
        .from('collects')
        .update({ received_at: new Date().toISOString() })
        .eq('id', saved.id)
      if (recvErr) throw recvErr
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: ['collect_items'] }),
        queryClient.invalidateQueries({ queryKey: ['collects'] }),
      ])
      showToast('Positions added to catalog ✓')
      setEditing(null)
    } catch {
      setFormError('Receiving failed — check your connection and try again.')
    } finally {
      setReceiveBusy(false)
    }
  }

  const today = todayISO()
  const received = editing !== 'new' && editing ? editing.received_at : null
  const hasPositions = positions.some((p) => p.item_id || p.name_text.trim())

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Collects</h1>
        <button
          onClick={() => {
            haptic()
            openEditor('new')
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          Add collect
        </button>
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {isError && <EmptyState icon={Printer} message="Failed to load collects." onRetry={() => refetch()} />}
      {!isLoading && !isError && (collects ?? []).length === 0 && <EmptyState icon={Printer} message="No production runs yet." />}

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
                {(positionsByCollect.get(c.id) ?? []).length > 0 && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-brand">
                    {(positionsByCollect.get(c.id) ?? []).map(positionLabel).join(' + ')}
                  </p>
                )}
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
                {c.received_at && (
                  <p className="mt-1 flex items-center justify-end gap-1 text-xs font-bold text-good">
                    <PackageCheck size={12} />
                    received
                  </p>
                )}
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
          <Field label="Positions">
            <div className="space-y-2">
              {positions.map((row, i) => (
                <div key={i} className="space-y-1.5 rounded-control border border-line p-2">
                  <div className="flex items-center gap-2">
                    <select
                      className={`${inputClass} min-w-0 flex-1`}
                      value={row.item_id}
                      onChange={(e) =>
                        setPositions(positions.map((r, j) => (j === i ? { ...r, item_id: e.target.value } : r)))
                      }
                    >
                      <option value="">＋ new item…</option>
                      {(items ?? []).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                    <div className="w-16 shrink-0">
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        aria-label="Quantity"
                        className={`${inputClass} text-center`}
                        value={row.qty}
                        onChange={(e) =>
                          setPositions(positions.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        haptic()
                        setPositions(positions.filter((_, j) => j !== i))
                      }}
                      className="tap flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-bad"
                      aria-label="Remove position"
                    >
                      ✕
                    </button>
                  </div>
                  {row.item_id === '' && (
                    <input
                      className={inputClass}
                      placeholder="new item name…"
                      value={row.name_text}
                      onChange={(e) =>
                        setPositions(positions.map((r, j) => (j === i ? { ...r, name_text: e.target.value } : r)))
                      }
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  haptic()
                  setPositions([...positions, { item_id: '', name_text: '', qty: '1' }])
                }}
                className="tap flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand"
              >
                <Plus size={14} strokeWidth={3} />
                Add position
              </button>
              {positions.length === 0 && (
                <p className="text-xs text-ink-faint">
                  Optional — list what you ordered. When the collect arrives, one tap adds everything to the catalog.
                </p>
              )}
            </div>
          </Field>
          <label className="mb-4 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-brand"
              checked={form.paid}
              onChange={(e) => setForm({ ...form, paid: e.target.checked })}
            />
            Paid
          </label>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending || receiveBusy}>
            Save
          </PrimaryButton>
          {received ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold text-good">
              <PackageCheck size={15} />
              Received {formatDate(received)} — stock already added
            </p>
          ) : (
            hasPositions && (
              <button
                type="button"
                onClick={() => {
                  haptic()
                  void receive()
                }}
                disabled={receiveBusy || insert.isPending || update.isPending}
                className="tap mt-2 flex h-12 w-full items-center justify-center gap-1.5 rounded-full border-2 border-good/50 text-sm font-bold text-good hover:bg-good/10 disabled:opacity-50"
              >
                <PackageCheck size={16} />
                {receiveBusy ? 'Adding to catalog…' : 'Received — add to catalog'}
              </button>
            )
          )}
          {formError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {formError}
            </p>
          )}
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
