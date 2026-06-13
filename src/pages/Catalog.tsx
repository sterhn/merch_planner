import React, { useMemo, useState } from 'react'
import type { Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { uploadItemImage } from '../lib/images'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

const EMPTY = { type: '', fandom: '', sku: '', name: '', cost_price: '', sale_price: '', stock_qty: '', image_url: '' }

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 shadow-sm hover:bg-violet-50'}`}
    >
      {children}
    </button>
  )
}

function ComboSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [adding, setAdding] = useState(!options.includes(value) && value !== '')
  const selectVal = adding ? '__new__' : value

  return (
    <div className="space-y-2">
      <select
        className={inputClass}
        value={selectVal}
        onChange={(e) => {
          if (e.target.value === '__new__') { setAdding(true); onChange('') }
          else { setAdding(false); onChange(e.target.value) }
        }}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__new__">＋ Add new…</option>
      </select>
      {adding && (
        <input
          autoFocus
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Type new value…'}
        />
      )}
    </div>
  )
}

export default function Catalog() {
  const { data: items, isLoading } = useList<Item>('items', { orderBy: 'type' })
  const insert = useInsert<Item>('items')
  const update = useUpdate<Item>('items')
  const remove = useDelete('items')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [fandomFilter, setFandomFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const types = useMemo(() => {
    const s = new Set((items ?? []).map((i) => i.type).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items])

  const fandoms = useMemo(() => {
    const s = new Set((items ?? []).map((i) => i.fandom).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (items ?? []).filter((i) => {
      if (typeFilter && i.type !== typeFilter) return false
      if (fandomFilter && i.fandom !== fandomFilter) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        (i.type ?? '').toLowerCase().includes(q) ||
        (i.fandom ?? '').toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search, typeFilter, fandomFilter])

  function autoSku(fandom: string) {
    const prefix = fandom.replace(/[\[\]]/g, '').toUpperCase()
    if (!prefix) return ''
    const count = (items ?? []).filter(
      (i) => (i.fandom ?? '').replace(/[\[\]]/g, '').toUpperCase() === prefix,
    ).length
    return `${prefix}-${String(count + 1).padStart(2, '0')}`
  }

  function openEditor(item: Item | 'new') {
    setEditing(item)
    setPhotoFile(null)
    if (item === 'new') {
      setForm(EMPTY)
    } else {
      setForm({
        type: item.type ?? '',
        fandom: item.fandom ?? '',
        sku: item.sku ?? '',
        name: item.name,
        cost_price: item.cost_price?.toString() ?? '',
        sale_price: item.sale_price?.toString() ?? '',
        stock_qty: item.stock_qty?.toString() ?? '',
        image_url: item.image_url ?? '',
      })
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    let imageUrl = form.image_url || null
    if (photoFile) {
      setUploading(true)
      try {
        imageUrl = await uploadItemImage(photoFile)
      } catch {
        alert('Photo upload failed — check that the item-images bucket exists (see README).')
        setUploading(false)
        return
      }
      setUploading(false)
    }
    const values = {
      type: form.type || null,
      fandom: form.fandom || null,
      sku: form.sku || null,
      name: form.name,
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
      image_url: imageUrl,
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
        className={`${inputClass} mb-3`}
      />

      {types.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={typeFilter === null} onClick={() => setTypeFilter(null)}>All types</FilterChip>
          {types.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>{t}</FilterChip>
          ))}
        </div>
      )}

      {fandoms.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={fandomFilter === null} onClick={() => setFandomFilter(null)}>All fandoms</FilterChip>
          {fandoms.map((f) => (
            <FilterChip key={f} active={fandomFilter === f} onClick={() => setFandomFilter(fandomFilter === f ? null : f)}>{f}</FilterChip>
          ))}
        </div>
      )}

      {isLoading && <EmptyState message="Loading…" />}
      {!isLoading && filtered.length === 0 && <EmptyState message="No items yet." />}

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => openEditor(item)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-sm hover:bg-violet-50"
          >
            {item.image_url ? (
              <img src={item.image_url} alt="" className="size-16 shrink-0 rounded-lg object-cover" loading="lazy" />
            ) : (
              <div className="size-16 shrink-0 rounded-lg bg-gray-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="truncate text-xs text-gray-500">
                {[item.type, item.fandom, item.sku].filter(Boolean).join(' · ') || '—'} · cost {formatRub(item.cost_price)} · profit {formatRub(item.profit)}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <ComboSelect
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={types}
                placeholder="брелок / значок…"
              />
            </Field>
            <Field label="Fandom">
              <ComboSelect
                value={form.fandom}
                onChange={(v) => {
                  const sku = form.sku || autoSku(v)
                  setForm({ ...form, fandom: v, sku })
                }}
                options={fandoms}
                placeholder="kdj / tgcf…"
              />
            </Field>
          </div>
          <Field label="Name">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <input className={inputClass} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="optional product code" />
          </Field>
          <Field label="Photo">
            <div className="flex items-center gap-3">
              {(photoFile || form.image_url) && (
                <img
                  src={photoFile ? URL.createObjectURL(photoFile) : form.image_url}
                  alt=""
                  className="size-14 rounded-lg object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-violet-700"
              />
              {(photoFile || form.image_url) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null)
                    setForm({ ...form, image_url: '' })
                  }}
                  className="shrink-0 rounded p-1 text-gray-400 hover:text-red-600"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              )}
            </div>
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
          <PrimaryButton type="submit" disabled={insert.isPending || update.isPending || uploading}>
            {uploading ? 'Uploading photo…' : 'Save'}
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
