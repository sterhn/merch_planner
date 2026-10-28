// The three sheets that change an order's items: add one (from the catalog or
// custom), edit one, and paste an import code from the store page.

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Item, OrderItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useInsert, useUpdate } from '../../hooks/useTable'
import { parseCount, parseMoney } from '../../lib/format'
import { importedOrderRows, parseImportCode } from '../../lib/importCode'
import { showToast } from '../../lib/toast'
import CatalogPicker from '../../components/CatalogPicker'
import Modal from '../../components/Modal'
import { Field, inputClass, PrimaryButton, SecondaryButton, textareaClass } from '../../components/FormField'

const EMPTY_LINE = { item_id: '', name_text: '', qty: '1', unit_price: '' }

export function AddLineSheet({
  open,
  onClose,
  orderId,
  catalog,
  itemNames,
  stockFor,
  nextPosition,
  lines,
}: {
  open: boolean
  onClose: () => void
  orderId: string
  /** Pickable items — the live catalog, archived items left out. */
  catalog: Item[]
  itemNames: ReadonlyMap<string, Item>
  stockFor: (item: Item) => number
  nextPosition: number
  /** The order's current lines: picking an item that's already on it adds to that line. */
  lines: OrderItem[]
}) {
  // Line writes refresh orders too (the list embeds lines for its thumbnails
  // and search, and the database recomputes the total) and items (a line on a
  // sent order moves stock).
  const insertLine = useInsert<OrderItem>('order_items', ['orders', 'items'])
  const updateLine = useUpdate<OrderItem>('order_items', ['orders', 'items'])
  const [form, setForm] = useState(EMPTY_LINE)
  const busy = insertLine.isPending || updateLine.isPending

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // "Add & next" keeps the sheet open, so a many-item order isn't a
    // reopen-the-sheet round trip per line.
    const another = (e.nativeEvent as SubmitEvent).submitter?.dataset.next === '1'
    const picked = form.item_id ? itemNames.get(form.item_id) : undefined
    const qty = parseCount(form.qty, 1) ?? 1
    const unitPrice = parseMoney(form.unit_price) ?? picked?.sale_price ?? null
    const done = (label: string) => {
      setForm(EMPTY_LINE)
      if (another) showToast(label)
      else onClose()
    }
    // The same item at the same price is already on the order: one line ×3
    // reads better than three lines ×1, on screen and on the printout.
    const same = picked && lines.find((l) => l.item_id === picked.id && l.unit_price === unitPrice)
    if (same) {
      updateLine.mutate(
        { id: same.id, values: { qty: same.qty + qty } },
        { onSuccess: () => done(`${picked.name} ×${same.qty + qty}`) },
      )
      return
    }
    insertLine.mutate(
      {
        order_id: orderId,
        item_id: form.item_id || null,
        name_text: form.name_text || picked?.name || null,
        category: picked?.type ?? null,
        qty,
        unit_price: unitPrice,
        position: nextPosition,
      },
      { onSuccess: () => done(`Added ${picked?.name || form.name_text || 'item'}`) },
    )
  }

  return (
    <Modal title="Add item" open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="From catalog">
          <CatalogPicker
            catalog={catalog}
            value={form.item_id}
            stockFor={stockFor}
            onSelect={(id) => {
              const picked = itemNames.get(id)
              setForm({
                ...form,
                item_id: id,
                unit_price: picked?.sale_price?.toString() ?? form.unit_price,
              })
            }}
          />
        </Field>
        {!form.item_id && (
          <Field label="Custom name">
            <input className={inputClass} value={form.name_text} onChange={(e) => setForm({ ...form, name_text: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            <input className={inputClass} type="number" min="1" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="Unit price ₽">
            <input className={inputClass} type="text" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-2">
          <SecondaryButton type="submit" data-next="1" disabled={busy} className="h-12 shrink-0">
            Add &amp; next
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy}>
            Add
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

/** Mount only while a line is being edited — the form starts from that line. */
export function EditLineSheet({
  line,
  itemNames,
  onClose,
}: {
  line: OrderItem
  itemNames: ReadonlyMap<string, Item>
  onClose: () => void
}) {
  const updateLine = useUpdate<OrderItem>('order_items', ['orders', 'items'])
  const [form, setForm] = useState({
    name_text: line.name_text ?? '',
    qty: String(line.qty),
    unit_price: line.unit_price?.toString() ?? '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    updateLine.mutate(
      {
        id: line.id,
        values: {
          ...(line.item_id ? {} : { name_text: form.name_text || null }),
          qty: parseCount(form.qty, 1) ?? 1,
          unit_price: parseMoney(form.unit_price),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="Edit item" open onClose={onClose}>
      <form onSubmit={submit}>
        {line.item_id ? (
          <p className="mb-3 truncate text-sm font-semibold">{itemNames.get(line.item_id)?.name ?? line.name_text ?? '—'}</p>
        ) : (
          <Field label="Name">
            <input className={inputClass} value={form.name_text} onChange={(e) => setForm({ ...form, name_text: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            <input className={inputClass} type="number" min="1" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="Unit price ₽">
            <input className={inputClass} type="text" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
        </div>
        <PrimaryButton type="submit" disabled={updateLine.isPending}>
          Save
        </PrimaryButton>
      </form>
    </Modal>
  )
}

export function ImportSheet({
  open,
  onClose,
  orderId,
  nextPosition,
}: {
  open: boolean
  onClose: () => void
  orderId: string
  nextPosition: number
}) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const items = parseImportCode(text)
    if (!items) {
      setError('Could not parse. Paste the import:[...] code (or the whole message) from the store page.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('order_items').insert(importedOrderRows(orderId, items, nextPosition))
      if (error) throw error
      void qc.invalidateQueries({ queryKey: ['order_items'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['items'] })
      setText('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Import items"
      open={open}
      onClose={() => {
        setError('')
        onClose()
      }}
    >
      <form onSubmit={submit}>
        <Field label="Paste order code">
          <textarea
            className={textareaClass}
            rows={5}
            placeholder='import:[{"id":"...","name":"...","qty":1,"price":650}]'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        {error && <p className="mb-3 text-sm font-semibold text-bad">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Importing…' : 'Import'}
        </PrimaryButton>
      </form>
    </Modal>
  )
}
