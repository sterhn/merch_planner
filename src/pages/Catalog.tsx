import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Tags, ImageOff, X, Loader2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { deleteItemImage, uploadItemImage } from '../lib/images'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { DangerButton, Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { type: '', fandom: '', sku: '', name: '', cost_price: '', sale_price: '', stock_qty: '', image_url: '' }

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-9 shrink-0 rounded-full px-4 text-xs font-bold ${active ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-card' : 'bg-surface text-ink-muted shadow-card'}`}
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

interface RawBundleItem { bundle_id: string; component_id: string; qty: number }

export default function Catalog() {
  const { data: items, isLoading, isError, refetch } = useList<Item>('items', { orderBy: 'type' })
  const { data: rawBundles } = useList<RawBundleItem>('bundle_items', {
    select: 'bundle_id, component_id, qty',
  })
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

  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items ?? []) m.set(i.id, i)
    return m
  }, [items])

  const bundleMap = useMemo(() => {
    const m = new Map<string, { name: string; qty: number }[]>()
    for (const b of rawBundles ?? []) {
      const name = itemById.get(b.component_id)?.name
      if (!name) continue
      const arr = m.get(b.bundle_id) ?? []
      arr.push({ name, qty: b.qty })
      m.set(b.bundle_id, arr)
    }
    return m
  }, [rawBundles, itemById])

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
    const prefix = fandom.replace(/[[\]]/g, '').toUpperCase()
    if (!prefix) return ''
    const count = (items ?? []).filter(
      (i) => (i.fandom ?? '').replace(/[[\]]/g, '').toUpperCase() === prefix,
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
    if (editing === 'new') {
      insert.mutate(values, { onSuccess: () => setEditing(null) })
    } else if (editing) {
      const oldUrl = editing.image_url
      update.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            if (oldUrl && oldUrl !== imageUrl) void deleteItemImage(oldUrl)
            setEditing(null)
          },
        },
      )
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Catalog</h1>
        <button
          onClick={() => {
            haptic()
            openEditor('new')
          }}
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card"
        >
          <Plus size={16} strokeWidth={3} />
          Add item
        </button>
      </div>
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-11`}
        />
      </div>

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

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {isError && <EmptyState icon={Tags} message="Failed to load catalog." onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && <EmptyState icon={Tags} message="No items yet." />}

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => openEditor(item)}
            className="tap flex w-full items-center justify-between gap-3 rounded-card bg-surface p-3.5 text-left shadow-card hover:bg-brand/10"
          >
            {item.image_url ? (
              <img src={item.image_url} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-faint">
                <ImageOff size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {[item.type, item.fandom, item.sku].filter(Boolean).join(' · ') || '—'} · cost {formatRub(item.cost_price)} · profit {formatRub(item.profit)}
              </p>
              {(bundleMap.get(item.id) ?? []).length > 0 && (
                <p className="mt-0.5 truncate text-xs font-semibold text-brand">
                  {(bundleMap.get(item.id) ?? []).map((b) => (b.qty > 1 ? `${b.name} ×${b.qty}` : b.name)).join(' + ')}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-sm">{formatRub(item.sale_price)}</p>
              <p className="text-xs text-ink-muted">stock: {item.stock_qty ?? 0}</p>
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
                  src={photoPreview ?? form.image_url}
                  alt=""
                  className="size-14 rounded-lg object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-xs text-ink-muted file:mr-2 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-brand"
              />
              {(photoFile || form.image_url) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null)
                    setForm({ ...form, image_url: '' })
                  }}
                  className="tap flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-bad"
                  aria-label="Remove photo"
                >
                  <X size={16} />
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
            <div className="mt-2">
              <DangerButton
                type="button"
                onClick={() => {
                  if (confirm('Delete this item?'))
                    remove.mutate(editing.id, {
                      onSuccess: () => {
                        void deleteItemImage(editing.image_url)
                        setEditing(null)
                      },
                    })
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
