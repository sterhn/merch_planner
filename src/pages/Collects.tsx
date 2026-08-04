import { useMemo, useState } from 'react'
import { Plus, Printer, AlertTriangle, CalendarClock, PackageCheck, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Collect, CollectItem, Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { supabase } from '../lib/supabase'
import { formatDate, formatRub, parseCount, parseMoney, todayISO } from '../lib/format'
import { failureMessage } from '../lib/errorMessage'
import { showToast } from '../lib/toast'
import Modal from '../components/Modal'
import CatalogPicker from '../components/CatalogPicker'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import StatusBadge from '../components/StatusBadge'
import {
  AddButton,
  DangerButton,
  Field,
  IconButton,
  inputClass,
  PrimaryButton,
  SecondaryButton,
} from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { name: '', vendor: '', commission: '', delivery_cost: '', deadline: '', paid: false }

interface PositionRow {
  item_id: string
  name_text: string
  qty: string
  print_cost: string
}

export default function Collects() {
  const { data: collects, isLoading, isError, refetch } = useList<Collect>('collects', {
    orderBy: 'deadline',
    ascending: false,
    // Undated runs have no deadline to be urgent about, so they belong at the
    // bottom rather than at the top where Postgres would put them.
    nullsFirst: false,
  })
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
  // Index of the position row whose item picker modal is open
  const [pickerFor, setPickerFor] = useState<number | null>(null)

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
          print_cost: p.print_cost?.toString() ?? '',
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
        qty: parseCount(p.qty, 1) ?? 1,
        print_cost: parseMoney(p.print_cost),
      }))
  }

  // ₽ per piece: sums used to prefill the collect totals and price new items.
  const positionTotals = useMemo(() => {
    const rows = positions
      .filter((p) => p.item_id || p.name_text.trim())
      .map((p) => ({
        qty: parseCount(p.qty, 1) ?? 1,
        print_cost: parseMoney(p.print_cost),
      }))
    return {
      qty: rows.reduce((s, p) => s + p.qty, 0),
      print: rows.reduce((s, p) => s + p.qty * (p.print_cost ?? 0), 0),
    }
  }, [positions])

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
    // Quantity and print cost come from the positions. Collects saved before
    // positions existed keep their stored values instead of being zeroed.
    const prev = editing !== 'new' && editing ? editing : null
    const values = {
      name: form.name || null,
      vendor: form.vendor || null,
      qty: positionTotals.qty > 0 ? positionTotals.qty : (prev?.qty ?? null),
      print_cost: positionTotals.print > 0 ? positionTotals.print : (prev?.print_cost ?? 0),
      commission: parseMoney(form.commission) ?? 0,
      delivery_cost: parseMoney(form.delivery_cost) ?? 0,
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
    } catch (err) {
      // The collect row may already exist at this point — syncPositions runs
      // after the insert — so say so rather than implying nothing happened.
      setFormError(failureMessage('Save', err))
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
  //
  // Not atomic: a failure partway leaves some stock applied while received_at
  // stays null, so a retry would double-count those items. Making it safe needs
  // a Postgres function doing the whole thing in one transaction.
  async function receive() {
    const saved = await doSave()
    if (!saved) return
    setReceiveBusy(true)
    try {
      const printTotal = saved.print_cost ?? 0
      const overhead = (saved.commission ?? 0) + (saved.delivery_cost ?? 0)
      const qtyTotal = saved.qty ?? 0
      // Overhead (commission + delivery) is spread evenly per piece; a position
      // with its own print cost gets that + overhead, otherwise the even split.
      const overheadPerUnit = qtyTotal > 0 ? overhead / qtyTotal : 0
      const evenPerUnit = qtyTotal > 0 ? (printTotal + overhead) / qtyTotal : null
      const unitCost = (r: CollectItem) =>
        r.print_cost != null
          ? Math.round((r.print_cost + overheadPerUnit) * 100) / 100
          : evenPerUnit != null
            ? Math.round(evenPerUnit * 100) / 100
            : null

      const { data: rows, error } = await supabase.from('collect_items').select('*').eq('collect_id', saved.id)
      if (error) throw error

      const all = (rows ?? []) as CollectItem[]
      const linked = all.filter((r): r is CollectItem & { item_id: string } => Boolean(r.item_id))
      const freeText = all.filter((r) => !r.item_id && r.name_text)

      // One read for every linked item instead of one per position. Quantities
      // are accumulated per item first: two positions can point at the same
      // item, and the writes below run concurrently, so they must not each
      // apply a delta to the same starting stock.
      const addByItem = new Map<string, number>()
      for (const r of linked) addByItem.set(r.item_id, (addByItem.get(r.item_id) ?? 0) + r.qty)

      if (addByItem.size > 0) {
        const { data: current, error: curErr } = await supabase
          .from('items')
          .select('id, stock_qty')
          .in('id', [...addByItem.keys()])
        if (curErr) throw curErr
        const stockById = new Map((current ?? []).map((i) => [i.id as string, (i.stock_qty as number) ?? 0]))

        await Promise.all(
          [...addByItem].map(async ([itemId, added]) => {
            const { error: updErr } = await supabase
              .from('items')
              .update({ stock_qty: (stockById.get(itemId) ?? 0) + added })
              .eq('id', itemId)
            if (updErr) throw updErr
          }),
        )
      }

      await Promise.all(
        freeText.map(async (r) => {
          const { data: created, error: insErr } = await supabase
            .from('items')
            .insert({ name: r.name_text, cost_price: unitCost(r), stock_qty: r.qty })
            .select('id')
            .single()
          if (insErr) throw insErr
          const { error: linkErr } = await supabase.from('collect_items').update({ item_id: created.id }).eq('id', r.id)
          if (linkErr) throw linkErr
        }),
      )
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
    } catch (err) {
      setFormError(failureMessage('Receiving', err))
    } finally {
      setReceiveBusy(false)
    }
  }

  const today = todayISO()
  const received = editing !== 'new' && editing ? editing.received_at : null
  const hasPositions = positions.some((p) => p.item_id || p.name_text.trim())

  return (
    <div>
      <PageHeader title="Collects">
        <AddButton onClick={() => openEditor('new')}>Add collect</AddButton>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={(collects ?? []).length === 0}
        icon={Printer}
        errorMessage="Failed to load collects."
        emptyMessage="No production runs yet."
        onRetry={() => void refetch()}
      />

      <div className="space-y-2">
        {(collects ?? []).map((c) => {
          const overdue = !c.paid && c.deadline != null && c.deadline < today
          const rowPositions = positionsByCollect.get(c.id) ?? []
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
                {rowPositions.length > 0 && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-brand">
                    {rowPositions.map(positionLabel).join(' + ')}
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
                    <button
                      type="button"
                      onClick={() => {
                        haptic()
                        setPickerFor(i)
                      }}
                      className={`${inputClass} tap flex min-w-0 flex-1 items-center text-left`}
                    >
                      <span className={`truncate ${row.item_id ? '' : 'text-ink-faint'}`}>
                        {row.item_id ? (itemById.get(row.item_id)?.name ?? '?') : '＋ new item — tap to pick existing'}
                      </span>
                    </button>
                    <IconButton
                      icon={X}
                      size={10}
                      tone="danger"
                      label="Remove position"
                      onClick={() => {
                        haptic()
                        setPositions(positions.filter((_, j) => j !== i))
                      }}
                    />
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
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-3xs font-bold uppercase tracking-wider text-ink-faint">Qty</span>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className={inputClass}
                        value={row.qty}
                        onChange={(e) =>
                          setPositions(positions.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-3xs font-bold uppercase tracking-wider text-ink-faint">Print ₽/pc</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className={inputClass}
                        value={row.print_cost}
                        onChange={(e) =>
                          setPositions(positions.map((r, j) => (j === i ? { ...r, print_cost: e.target.value } : r)))
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  haptic()
                  setPositions([...positions, { item_id: '', name_text: '', qty: '1', print_cost: '' }])
                }}
                className="tap flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand"
              >
                <Plus size={14} strokeWidth={3} />
                Add position
              </button>
              {positions.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  Optional — list what you ordered. When the collect arrives, one tap adds everything to the catalog.
                </p>
              ) : (
                <p className="text-xs text-ink-faint">
                  Total: {positionTotals.qty} pcs · print {formatRub(positionTotals.print)}
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
              <SecondaryButton
                tone="good"
                onClick={() => void receive()}
                disabled={receiveBusy || insert.isPending || update.isPending}
                className="mt-2 h-12 w-full"
              >
                <PackageCheck size={16} />
                {receiveBusy ? 'Adding to catalog…' : 'Received — add to catalog'}
              </SecondaryButton>
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

      <Modal title="Pick item" open={pickerFor !== null} onClose={() => setPickerFor(null)}>
        <CatalogPicker
          catalog={items ?? []}
          value={pickerFor !== null ? (positions[pickerFor]?.item_id ?? '') : ''}
          customLabel="＋ new item (enter name below)"
          stockFor={(i) => i.stock_qty ?? 0}
          onSelect={(id) => {
            if (pickerFor !== null) {
              setPositions(positions.map((r, j) => (j === pickerFor ? { ...r, item_id: id } : r)))
            }
            setPickerFor(null)
          }}
        />
      </Modal>
    </div>
  )
}
