import { useMemo, useState } from 'react'
import type { Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const EMPTY = { type: '', name: '', cost_price: '', sale_price: '', stock_qty: '' }

export default function Catalog() {
  const { data: items, isLoading } = useList<Item>('items', { orderBy: 'type' })
  const insert = useInsert<Item>('items')
  const update = useUpdate<Item>('items')
  const remove = useDelete('items')

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items ?? []
    return (items ?? []).filter(
      (i) => i.name.toLowerCase().includes(q) || (i.type ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

  function openEditor(item: Item | 'new') {
    setEditing(item)
    if (item === 'new') {
      setForm(EMPTY)
    } else {
      setForm({
        type: item.type ?? '',
        name: item.name,
        cost_price: item.cost_price?.toString() ?? '',
        sale_price: item.sale_price?.toString() ?? '',
        stock_qty: item.stock_qty?.toString() ?? '',
      })
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const values = {
      type: form.type || null,
      name: form.name,
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
    }
    if (editing === 'new') insert.mutate(values, { onSuccess: () => setEditing(null) })
    else if (editing) update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Catalog</h1>
        <button
          onClick={() => openEditor('new')}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
        >
          + Add item
        </button>
      </div>
      <input
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputClass} mb-4`}
      />

      {isLoading && <EmptyState message="Loading…" />}
      {!isLoading && filtered.length === 0 && <EmptyState message="No items yet." />}

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => openEditor(item)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-sm hover:bg-violet-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-gray-500">
                {item.type ?? '—'} · cost {formatRub(item.cost_price)} · profit {formatRub(item.profit)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold">{formatRub(item.sale_price)}</p>
              <p className="text-xs text-gray-500">stock: {item.stock_qty ?? 0}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal title={editing === 'new' ? 'Add item' : 'Edit item'} open={editing !== null} onClose={() => setEditing(null)}>
        <form onSubmit={save}>
          <Field label="Type">
            <input className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="брелок / значок / открытка…" />
          </Field>
          <Field label="Name">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cost ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </Field>
            <Field label="Price ₽">
              <input className={inputClass} type="number" step="0.01" inputMode="decimal" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </Field>
            <Field label="Stock">
              <input className={inputClass} type="number" inputMode="numeric" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending}>
            Save
          </PrimaryButton>
          {editing !== 'new' && editing && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this item?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
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
