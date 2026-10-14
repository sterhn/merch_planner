import { useMemo, useState } from 'react'
import { PackageCheck, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Collect, CollectItem, Item } from '../../lib/types'
import { useDelete, useInsert, useUpdate } from '../../hooks/useTable'
import { supabase } from '../../lib/supabase'
import { formatDate, formatRub, parseCount, parseMoney } from '../../lib/format'
import { failureMessage } from '../../lib/errorMessage'
import { showToast } from '../../lib/toast'
import { haptic } from '../../lib/haptics'
import { celebrate } from '../../lib/confetti'
import { useConfirm } from '../../hooks/useConfirm'
import Modal from '../../components/Modal'
import CatalogPicker from '../../components/CatalogPicker'
import { AddRowButton, PickRowButton } from '../../components/RowEditor'
import {
  DangerButton,
  Field,
  IconButton,
  inputClass,
  PrimaryButton,
  SecondaryButton,
} from '../../components/FormField'

interface PositionRow {
  item_id: string
  name_text: string
  qty: string
  print_cost: string
}

function formFor(c: Collect | 'new') {
  if (c === 'new') return { name: '', vendor: '', commission: '', delivery_cost: '', deadline: '', arrives_by: '', paid: false }
  return {
    name: c.name ?? '',
    vendor: c.vendor ?? '',
    commission: c.commission?.toString() ?? '',
    delivery_cost: c.delivery_cost?.toString() ?? '',
    deadline: c.deadline ?? '',
    arrives_by: c.arrives_by ?? '',
    paid: c.paid,
  }
}

/**
 * Add / edit sheet for one collect: costs, the two dates, its positions, and
 * "Received — add to catalog". Mount it only while editing — the form starts
 * from `collect` and its `positions`.
 */
export default function CollectEditor({
  collect,
  positions: savedPositions,
  items,
  onClose,
}: {
  collect: Collect | 'new'
  /** This collect's saved positions (empty for a new one). */
  positions: CollectItem[]
  items: Item[]
  onClose: () => void
}) {
  // The editor shows save failures inline (and stays open), so the global
  // error toast would be a duplicate.
  const insert = useInsert<Collect>('collects', ['expense_feed'], { suppressErrorToast: true })
  const update = useUpdate<Collect>('collects', ['expense_feed'], { suppressErrorToast: true })
  const remove = useDelete('collects', ['expense_feed'])
  const queryClient = useQueryClient()
  const { confirm, element: confirmSheet } = useConfirm()

  // Becomes the created row after a first save, so a retry updates instead
  // of inserting a second copy.
  const [editing, setEditing] = useState<Collect | 'new'>(collect)
  const [form, setForm] = useState(() => formFor(collect))
  const [positions, setPositions] = useState<PositionRow[]>(() =>
    savedPositions.map((p) => ({
      item_id: p.item_id ?? '',
      name_text: p.name_text ?? '',
      qty: String(p.qty),
      print_cost: p.print_cost?.toString() ?? '',
    })),
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [receiveBusy, setReceiveBusy] = useState(false)
  // Index of the position row whose item picker modal is open
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const existing = editing === 'new' ? null : editing

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items) m.set(i.id, i)
    return m
  }, [items])

  // Retired items aren't offered for new positions.
  const pickable = useMemo(() => items.filter((i) => !i.archived), [items])

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

  // Replaces the collect's positions with the editor rows in one transaction
  // (save_collect_items, migration 010). No-op for collects that never had
  // positions.
  async function syncPositions(collectId: string) {
    const rows = cleanPositions()
    if (rows.length === 0 && savedPositions.length === 0) return
    const { error } = await supabase.rpc('save_collect_items', { p_collect_id: collectId, p_rows: rows })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['collect_items'] })
  }

  // Saves the collect + positions; returns the saved collect or null on failure.
  async function doSave(): Promise<Collect | null> {
    setFormError(null)
    // Quantity and print cost come from the positions. Collects saved before
    // positions existed keep their stored values instead of being zeroed.
    const values = {
      name: form.name || null,
      vendor: form.vendor || null,
      qty: positionTotals.qty > 0 ? positionTotals.qty : (existing?.qty ?? null),
      print_cost: positionTotals.print > 0 ? positionTotals.print : (existing?.print_cost ?? 0),
      commission: parseMoney(form.commission) ?? 0,
      delivery_cost: parseMoney(form.delivery_cost) ?? 0,
      deadline: form.deadline || null,
      arrives_by: form.arrives_by || null,
      paid: form.paid,
    }
    try {
      let saved: Collect
      if (existing) {
        await update.mutateAsync({ id: existing.id, values })
        saved = { ...existing, ...values }
      } else {
        saved = await insert.mutateAsync(values)
        // If the position sync below fails, a retry must update, not re-insert.
        setEditing(saved)
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
      if (saved) onClose()
    })
  }

  // The collect arrived: bump stock for linked items, turn free-text positions
  // into new catalog items (cost = this collect's per-unit cost), and stamp
  // received_at so it can't be applied twice. All of it happens inside one
  // Postgres function (receive_collect, migration 009) so a failure partway
  // can't leave stock half-applied — it fully applies or not at all.
  async function receive() {
    const saved = await doSave()
    if (!saved) return
    setReceiveBusy(true)
    try {
      const { error } = await supabase.rpc('receive_collect', { p_collect_id: saved.id })
      if (error) throw error
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: ['collect_items'] }),
        queryClient.invalidateQueries({ queryKey: ['collects'] }),
      ])
      showToast('Positions added to catalog ✓')
      celebrate()
      onClose()
    } catch (err) {
      setFormError(failureMessage('Receiving', err))
    } finally {
      setReceiveBusy(false)
    }
  }

  const received = existing?.received_at ?? null
  const hasPositions = positions.some((p) => p.item_id || p.name_text.trim())

  return (
    <>
      <Modal title={existing ? 'Edit collect' : 'Add collect'} open onClose={onClose}>
        <form onSubmit={save}>
          <Field label="What's printed">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Collect / vendor">
            <input className={inputClass} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          {/* Money fields are text, not number: a number input rejects the comma
              decimal separator a Russian keyboard produces (parseMoney handles it). */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
            </Field>
            <Field label="Delivery ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={form.delivery_cost} onChange={(e) => setForm({ ...form, delivery_cost: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pay by">
              <input className={inputClass} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <Field label="Arrives by">
              <input className={inputClass} type="date" value={form.arrives_by} onChange={(e) => setForm({ ...form, arrives_by: e.target.value })} />
            </Field>
          </div>
          <Field label="Positions">
            <div className="space-y-2">
              {positions.map((row, i) => (
                <div key={i} className="space-y-1.5 rounded-control border border-line p-2">
                  <div className="flex items-center gap-2">
                    <PickRowButton
                      label={row.item_id ? (itemById.get(row.item_id)?.name ?? '?') : null}
                      empty="＋ new item — tap to pick existing"
                      onClick={() => setPickerFor(i)}
                    />
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
                        type="text"
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
              <AddRowButton
                onClick={() => setPositions([...positions, { item_id: '', name_text: '', qty: '1', print_cost: '' }])}
              >
                Add position
              </AddRowButton>
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
          {existing && (
            <div className="mt-2">
              <DangerButton
                type="button"
                onClick={() =>
                  confirm('Delete this collect?', () => remove.mutate(existing.id, { onSuccess: onClose }))
                }
              >
                Delete
              </DangerButton>
            </div>
          )}
        </form>
      </Modal>

      <Modal title="Pick item" open={pickerFor !== null} onClose={() => setPickerFor(null)}>
        <CatalogPicker
          catalog={pickable}
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

      {confirmSheet}
    </>
  )
}
