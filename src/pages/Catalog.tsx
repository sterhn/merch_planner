import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Tags, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { deleteItemImage, uploadItemImage, uploadProductPhoto } from '../lib/images'
import { buildableCount, groupBundles, type BundleComponent } from '../lib/bundles'
import { supabase } from '../lib/supabase'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import FilterChip from '../components/FilterChip'
import { DangerButton, Field, inputClass, PrimaryButton, textareaClass } from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { type: '', fandom: '', sku: '', name: '', description: '', cost_price: '', sale_price: '', stock_qty: '', image_url: '', product_photo_url: '' }

function PhotoField({ label, url, file, onPick, onClear, pct, alt }: {
  label: string
  url: string
  file: File | null
  onPick: (f: File | null) => void
  onClear: () => void
  pct: number | null
  alt: string
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {(file || url) && (
          <img src={preview ?? url} alt={alt} className="size-14 rounded-lg object-cover" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="min-w-0 flex-1 text-xs text-ink-muted file:mr-2 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-brand"
        />
        {(file || url) && (
          <button
            type="button"
            onClick={onClear}
            className="tap flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-bad"
            aria-label="Remove photo"
          >
            ✕
          </button>
        )}
      </div>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </Field>
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

function ItemImage({ src, type }: { src: string | null; type: string | null }) {
  if (src) {
    return <img src={src} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
  }
  const initial = (type ?? '★').charAt(0).toUpperCase()
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 font-display text-xl font-bold text-brand/50">
      {initial}
    </div>
  )
}

export default function Catalog() {
  const { data: items, isLoading, isError, refetch } = useList<Item>('items', { orderBy: 'type' })
  const { data: rawBundles } = useList<BundleComponent>('bundle_items', {
    select: 'bundle_id, component_id, qty',
  })
  const insert = useInsert<Item>('items')
  const update = useUpdate<Item>('items')
  const remove = useDelete('items')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [fandomFilter, setFandomFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [viewing, setViewing] = useState<Item | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [bundleRows, setBundleRows] = useState<{ component_id: string; qty: string }[]>([])
  const [itemPhoto, setItemPhoto] = useState<File | null>(null)
  const [productPhoto, setProductPhoto] = useState<File | null>(null)
  const [itemPct, setItemPct] = useState<number | null>(null)
  const [productPct, setProductPct] = useState<number | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const uploading = itemPct !== null || productPct !== null

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items ?? []) m.set(i.id, i)
    return m
  }, [items])

  const bundleGroups = useMemo(() => groupBundles(rawBundles), [rawBundles])

  const bundleMap = useMemo(() => {
    const m = new Map<string, { name: string; qty: number }[]>()
    for (const [bundleId, comps] of bundleGroups) {
      const named = comps
        .map((c) => ({ name: itemById.get(c.component_id)?.name, qty: c.qty }))
        .filter((c): c is { name: string; qty: number } => Boolean(c.name))
      if (named.length > 0) m.set(bundleId, named)
    }
    return m
  }, [bundleGroups, itemById])

  const types = useMemo(() => {
    const s = new Set((items ?? []).map((i) => i.type).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items])

  const fandoms = useMemo(() => {
    const s = new Set((items ?? []).map((i) => i.fandom).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items])

  const componentOptions = useMemo(() => {
    const selfId = editing !== 'new' && editing ? editing.id : null
    return (items ?? [])
      .filter((i) => i.id !== selfId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [items, editing])

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
    setItemPhoto(null)
    setProductPhoto(null)
    setPhotoError(null)
    setSaveError(null)
    if (item === 'new') {
      setForm(EMPTY)
      setBundleRows([])
    } else {
      setForm({
        type: item.type ?? '',
        fandom: item.fandom ?? '',
        sku: item.sku ?? '',
        name: item.name,
        description: item.description ?? '',
        cost_price: item.cost_price?.toString() ?? '',
        sale_price: item.sale_price?.toString() ?? '',
        stock_qty: item.stock_qty?.toString() ?? '',
        image_url: item.image_url ?? '',
        product_photo_url: item.product_photo_url ?? '',
      })
      setBundleRows(
        (rawBundles ?? [])
          .filter((b) => b.bundle_id === item.id)
          .map((b) => ({ component_id: b.component_id, qty: String(b.qty) })),
      )
    }
  }

  // Replaces the item's bundle composition with the editor rows (merging
  // duplicate component picks). No-op for items that never were bundles.
  async function syncBundleItems(bundleId: string) {
    const merged = new Map<string, number>()
    for (const row of bundleRows) {
      if (!row.component_id) continue
      const qty = Math.max(1, Math.round(Number(row.qty)) || 1)
      merged.set(row.component_id, (merged.get(row.component_id) ?? 0) + qty)
    }
    const rows = Array.from(merged, ([component_id, qty]) => ({ bundle_id: bundleId, component_id, qty }))
    if (rows.length === 0 && !(rawBundles ?? []).some((b) => b.bundle_id === bundleId)) return
    const { error: delError } = await supabase.from('bundle_items').delete().eq('bundle_id', bundleId)
    if (delError) throw delError
    if (rows.length > 0) {
      const { error } = await supabase.from('bundle_items').insert(rows)
      if (error) throw error
    }
    await queryClient.invalidateQueries({ queryKey: ['bundle_items'] })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setPhotoError(null)
    setSaveError(null)
    let imageUrl = form.image_url || null
    let productUrl = form.product_photo_url || null
    // Keep uploaded URLs in the form so a retry after a failure further down
    // doesn't upload the same photo a second time.
    if (itemPhoto) {
      setItemPct(0)
      try {
        imageUrl = await uploadItemImage(itemPhoto, setItemPct)
        setItemPhoto(null)
        setForm((f) => ({ ...f, image_url: imageUrl ?? '' }))
      } catch {
        setPhotoError('Item photo upload failed — check that the item-images bucket exists (see README).')
        return
      } finally {
        setItemPct(null)
      }
    }
    if (productPhoto) {
      setProductPct(0)
      try {
        productUrl = await uploadProductPhoto(productPhoto, setProductPct)
        setProductPhoto(null)
        setForm((f) => ({ ...f, product_photo_url: productUrl ?? '' }))
      } catch {
        setPhotoError('Product photo upload failed — check that the product-photos bucket exists (see README).')
        return
      } finally {
        setProductPct(null)
      }
    }
    const values = {
      type: form.type || null,
      fandom: form.fandom || null,
      sku: form.sku || null,
      name: form.name,
      description: form.description.trim() || null,
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
      image_url: imageUrl,
      product_photo_url: productUrl,
    }
    try {
      const old = editing !== 'new' && editing ? editing : null
      let savedId: string
      if (editing === 'new') {
        const created = await insert.mutateAsync(values)
        savedId = created.id
        // If the bundle sync below fails, a retry must update, not re-insert.
        setEditing(created)
      } else if (editing) {
        await update.mutateAsync({ id: editing.id, values })
        savedId = editing.id
      } else {
        return
      }
      await syncBundleItems(savedId)
      if (old?.image_url && old.image_url !== imageUrl) void deleteItemImage(old.image_url)
      if (old?.product_photo_url && old.product_photo_url !== productUrl) void deleteItemImage(old.product_photo_url)
      setEditing(null)
    } catch {
      setSaveError('Save failed — check your connection and try again.')
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
          className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-card"
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
        {filtered.map((item) => {
          const canMake = buildableCount(item.id, bundleGroups, itemById)
          const stockShown = canMake ?? item.stock_qty ?? 0
          return (
            <div key={item.id} className="flex w-full items-center gap-3 rounded-card bg-surface p-3.5 shadow-card">
              <button
                type="button"
                onClick={() => {
                  haptic()
                  setViewing(item)
                }}
                aria-label={`View ${item.name}`}
                className="tap shrink-0"
              >
                <ItemImage src={item.image_url} type={item.type} />
              </button>
              <button
                type="button"
                onClick={() => openEditor(item)}
                className="tap flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
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
                  <p className={`text-xs font-semibold ${stockShown <= 2 ? 'text-bad' : 'text-ink-faint'}`}>
                    {canMake !== null ? `can make: ${canMake}` : `stock: ${stockShown}`}
                  </p>
                </div>
              </button>
            </div>
          )
        })}
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
          <Field label="Description">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="optional — materials, size, notes…"
            />
          </Field>
          <PhotoField
            label="Item photo (small)"
            url={form.image_url}
            file={itemPhoto}
            onPick={setItemPhoto}
            onClear={() => {
              setItemPhoto(null)
              setForm({ ...form, image_url: '' })
            }}
            pct={itemPct}
            alt={form.name ? `Photo of ${form.name}` : 'Item photo'}
          />
          <PhotoField
            label="Product photo (large)"
            url={form.product_photo_url}
            file={productPhoto}
            onPick={setProductPhoto}
            onClear={() => {
              setProductPhoto(null)
              setForm({ ...form, product_photo_url: '' })
            }}
            pct={productPct}
            alt={form.name ? `Product photo of ${form.name}` : 'Product photo'}
          />
          <Field label="Bundle components">
            <div className="space-y-2">
              {bundleRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className={`${inputClass} min-w-0 flex-1`}
                    value={row.component_id}
                    onChange={(e) =>
                      setBundleRows(bundleRows.map((r, j) => (j === i ? { ...r, component_id: e.target.value } : r)))
                    }
                  >
                    <option value="">— select item —</option>
                    {componentOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Quantity"
                    className={`${inputClass} w-20 shrink-0 text-center`}
                    value={row.qty}
                    onChange={(e) =>
                      setBundleRows(bundleRows.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      haptic()
                      setBundleRows(bundleRows.filter((_, j) => j !== i))
                    }}
                    className="tap flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-bad"
                    aria-label="Remove component"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  haptic()
                  setBundleRows([...bundleRows, { component_id: '', qty: '1' }])
                }}
                className="tap flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand"
              >
                <Plus size={14} strokeWidth={3} />
                Add component
              </button>
              {bundleRows.length === 0 && (
                <p className="text-xs text-ink-faint">Optional — list what's inside if this item is a set.</p>
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
          {(photoError || saveError) && (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {photoError ?? saveError}
            </p>
          )}
          {editing !== 'new' && editing && (
            <div className="mt-2">
              <DangerButton
                type="button"
                onClick={() => {
                  if (confirm('Delete this item?'))
                    remove.mutate(editing.id, {
                      onSuccess: () => {
                        void deleteItemImage(editing.image_url)
                        void deleteItemImage(editing.product_photo_url)
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

      <Modal title={viewing?.name ?? 'Item'} open={viewing !== null} onClose={() => setViewing(null)}>
        {viewing && (
          <div>
            {(viewing.product_photo_url || viewing.image_url) && (
              <img
                src={viewing.product_photo_url ?? viewing.image_url ?? undefined}
                alt={viewing.name}
                className="mb-4 max-h-[55dvh] w-full rounded-card bg-surface-2 object-contain"
              />
            )}
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {[viewing.type, viewing.fandom, viewing.sku].filter(Boolean).join(' · ') || '—'}
            </p>
            {viewing.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{viewing.description}</p>
            )}
            {(bundleMap.get(viewing.id) ?? []).length > 0 && (
              <p className="mt-2 text-sm font-semibold text-brand">
                {(bundleMap.get(viewing.id) ?? []).map((b) => (b.qty > 1 ? `${b.name} ×${b.qty}` : b.name)).join(' + ')}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-sm text-ink-muted">
                cost {formatRub(viewing.cost_price)} · profit {formatRub(viewing.profit)} ·{' '}
                {buildableCount(viewing.id, bundleGroups, itemById) !== null
                  ? `can make ${buildableCount(viewing.id, bundleGroups, itemById)}`
                  : `stock ${viewing.stock_qty ?? 0}`}
              </p>
              <p className="font-display text-lg">{formatRub(viewing.sale_price)}</p>
            </div>
            <div className="mt-4">
              <PrimaryButton
                type="button"
                onClick={() => {
                  setViewing(null)
                  openEditor(viewing)
                }}
              >
                Edit
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
