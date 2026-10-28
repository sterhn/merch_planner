import React, { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Copy, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Item } from '../../lib/types'
import { useDelete, useInsert, useUpdate } from '../../hooks/useTable'
import { deleteItemImage, uploadItemImage, uploadProductPhoto } from '../../lib/images'
import type { BundleComponent } from '../../lib/bundles'
import { supabase } from '../../lib/supabase'
import { failureMessage } from '../../lib/errorMessage'
import { parseCount, parseMoney } from '../../lib/format'
import { autoSku } from '../../lib/sku'
import { haptic } from '../../lib/haptics'
import { showToast } from '../../lib/toast'
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
  textareaClass,
} from '../../components/FormField'

const EMPTY = { type: '', fandom: '', sku: '', name: '', description: '', cost_price: '', sale_price: '', stock_qty: '', image_url: '', product_photo_url: '' }

function formFor(item: Item | 'new', copyOf: Item | undefined, items: Item[]) {
  // A copy keeps the type, fandom, prices and description — the parts a
  // variant shares — and starts its own SKU, stock and photos. (Photos aren't
  // shared: replacing one item's photo deletes the old file from storage.)
  if (copyOf) {
    return {
      ...EMPTY,
      type: copyOf.type ?? '',
      fandom: copyOf.fandom ?? '',
      sku: copyOf.fandom ? autoSku(copyOf.fandom, copyOf.type ?? '', items) : '',
      name: copyOf.name,
      description: copyOf.description ?? '',
      cost_price: copyOf.cost_price?.toString() ?? '',
      sale_price: copyOf.sale_price?.toString() ?? '',
    }
  }
  if (item === 'new') return EMPTY
  return {
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
  }
}

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
        {(file || url) && <IconButton icon={X} size={10} tone="danger" label="Remove photo" onClick={onClear} />}
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

/**
 * Add / edit sheet for one catalog item: details, photos, bundle parts,
 * archive and delete. Mount it only while editing — its form starts from
 * `item`.
 */
export default function ItemEditor({
  item,
  items,
  rawBundles,
  types,
  fandoms,
  onClose,
  copyOf,
  onDuplicate,
}: {
  item: Item | 'new'
  /** Start a new item from this one (Duplicate). */
  copyOf?: Item
  /** Opens a new item pre-filled from this one. */
  onDuplicate?: (item: Item) => void
  items: Item[]
  rawBundles: BundleComponent[]
  types: string[]
  fandoms: string[]
  onClose: () => void
}) {
  // The editor shows save failures inline (and stays open), so the global
  // error toast would be a duplicate.
  const insert = useInsert<Item>('items', [], { suppressErrorToast: true })
  const update = useUpdate<Item>('items', [], { suppressErrorToast: true })
  const remove = useDelete('items')
  const queryClient = useQueryClient()
  const { confirm, element: confirmSheet } = useConfirm()

  // Becomes the created row after a first save, so a retry updates instead
  // of inserting a second copy.
  const [editing, setEditing] = useState<Item | 'new'>(item)
  const [form, setForm] = useState(() => formFor(item, copyOf, items))
  const [bundleRows, setBundleRows] = useState<{ component_id: string; qty: string }[]>(() =>
    item === 'new'
      ? copyOf
        ? rawBundles.filter((b) => b.bundle_id === copyOf.id).map((b) => ({ component_id: b.component_id, qty: String(b.qty) }))
        : []
      : rawBundles.filter((b) => b.bundle_id === item.id).map((b) => ({ component_id: b.component_id, qty: String(b.qty) })),
  )
  // Index of the bundle row whose component picker modal is open
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [itemPhoto, setItemPhoto] = useState<File | null>(null)
  const [productPhoto, setProductPhoto] = useState<File | null>(null)
  const [itemPct, setItemPct] = useState<number | null>(null)
  const [productPct, setProductPct] = useState<number | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const uploading = itemPct !== null || productPct !== null
  const existing = editing === 'new' ? null : editing

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items) m.set(i.id, i)
    return m
  }, [items])

  // A bundle can't contain itself, and retired items aren't offered as parts.
  const componentOptions = useMemo(
    () =>
      items
        .filter((i) => i.id !== existing?.id && !i.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [items, existing],
  )

  // Replaces the item's bundle composition with the editor rows (merging
  // duplicate component picks) in one transaction — save_bundle_items,
  // migration 010. No-op for items that never were bundles.
  async function syncBundleItems(bundleId: string) {
    const merged = new Map<string, number>()
    for (const row of bundleRows) {
      if (!row.component_id) continue
      const qty = parseCount(row.qty, 1) ?? 1
      merged.set(row.component_id, (merged.get(row.component_id) ?? 0) + qty)
    }
    const rows = Array.from(merged, ([component_id, qty]) => ({ component_id, qty }))
    if (rows.length === 0 && !rawBundles.some((b) => b.bundle_id === bundleId)) return
    const { error } = await supabase.rpc('save_bundle_items', { p_bundle_id: bundleId, p_rows: rows })
    if (error) throw error
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
      cost_price: parseMoney(form.cost_price),
      sale_price: parseMoney(form.sale_price),
      stock_qty: parseCount(form.stock_qty),
      image_url: imageUrl,
      product_photo_url: productUrl,
    }
    try {
      let savedId: string
      if (existing) {
        await update.mutateAsync({ id: existing.id, values })
        savedId = existing.id
      } else {
        const created = await insert.mutateAsync(values)
        savedId = created.id
        // If the bundle sync below fails, a retry must update, not re-insert.
        setEditing(created)
      }
      await syncBundleItems(savedId)
      if (existing?.image_url && existing.image_url !== imageUrl) void deleteItemImage(existing.image_url)
      if (existing?.product_photo_url && existing.product_photo_url !== productUrl) void deleteItemImage(existing.product_photo_url)
      onClose()
    } catch (err) {
      setSaveError(failureMessage('Save', err))
    }
  }

  // Archiving hides the item from the catalog and pickers but keeps it linked
  // to the orders and collects that used it — the safe way to retire one.
  async function setArchived(archived: boolean) {
    if (!existing) return
    setSaveError(null)
    try {
      await update.mutateAsync({ id: existing.id, values: { archived } })
      haptic()
      showToast(archived ? `${existing.name} archived` : `${existing.name} is back in the catalog`, {
        label: 'Undo',
        // The sheet is gone by the time Undo is tapped, so this can't lean on
        // its mutation hooks.
        onClick: () =>
          void supabase
            .from('items')
            .update({ archived: !archived })
            .eq('id', existing.id)
            .then(({ error }) => {
              if (error) showToast(failureMessage('Undo', error))
              void queryClient.invalidateQueries({ queryKey: ['items'] })
            }),
      })
      onClose()
    } catch (err) {
      setSaveError(failureMessage(archived ? 'Archive' : 'Restore', err))
    }
  }

  return (
    <>
      <Modal title={existing ? 'Edit item' : 'Add item'} open onClose={onClose}>
        <form onSubmit={save}>
          {copyOf && !existing && (
            <p className="mb-3 rounded-control bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-muted">
              Copy of {copyOf.name} — give it its own name, photo and stock.
            </p>
          )}
          {existing?.archived && (
            <p className="mb-3 rounded-control bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-muted">
              Archived — hidden from the catalog and item pickers.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <ComboSelect
                value={form.type}
                onChange={(v) => {
                  const sku = form.fandom ? autoSku(form.fandom, v, items) : ''
                  setForm({ ...form, type: v, ...(sku && !form.sku ? { sku } : {}) })
                }}
                options={types}
                placeholder="брелок / значок…"
              />
            </Field>
            <Field label="Fandom">
              <ComboSelect
                value={form.fandom}
                onChange={(v) => {
                  const sku = form.sku || autoSku(v, form.type, items)
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
                  <PickRowButton
                    label={row.component_id ? (itemById.get(row.component_id)?.name ?? '?') : null}
                    empty="tap to pick item…"
                    onClick={() => setPickerFor(i)}
                  />
                  {/* wrapper fixes the width: inputClass's w-full would win over w-20 */}
                  <div className="w-16 shrink-0">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label="Quantity"
                      className={`${inputClass} text-center`}
                      value={row.qty}
                      onChange={(e) =>
                        setBundleRows(bundleRows.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                      }
                    />
                  </div>
                  <IconButton
                    icon={X}
                    size={10}
                    tone="danger"
                    label="Remove component"
                    onClick={() => {
                      haptic()
                      setBundleRows(bundleRows.filter((_, j) => j !== i))
                    }}
                  />
                </div>
              ))}
              <AddRowButton onClick={() => setBundleRows([...bundleRows, { component_id: '', qty: '1' }])}>
                Add component
              </AddRowButton>
              {bundleRows.length === 0 && (
                <p className="text-xs text-ink-faint">Optional — list what's inside if this item is a set.</p>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            {/* Money fields are text, not number: a number input rejects the comma
                decimal separator a Russian keyboard produces (parseMoney handles it). */}
            <Field label="Cost ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </Field>
            <Field label="Price ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
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
          {existing && (
            <div className="mt-2 space-y-1">
              {onDuplicate && !existing.archived && (
                <SecondaryButton className="h-12 w-full" onClick={() => onDuplicate(existing)}>
                  <Copy size={16} />
                  Duplicate as a new item
                </SecondaryButton>
              )}
              <SecondaryButton
                className="h-12 w-full"
                onClick={() => void setArchived(!existing.archived)}
                disabled={update.isPending}
              >
                {existing.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                {existing.archived ? 'Restore to catalog' : 'Archive'}
              </SecondaryButton>
              <DangerButton
                type="button"
                onClick={() =>
                  confirm(
                    'Delete for good? Archive keeps it on old orders and collects; delete unlinks it everywhere.',
                    () =>
                      remove.mutate(existing.id, {
                        onSuccess: () => {
                          void deleteItemImage(existing.image_url)
                          void deleteItemImage(existing.product_photo_url)
                          onClose()
                        },
                      }),
                  )
                }
              >
                Delete
              </DangerButton>
            </div>
          )}
        </form>
      </Modal>

      <Modal title="Pick component" open={pickerFor !== null} onClose={() => setPickerFor(null)}>
        <CatalogPicker
          catalog={componentOptions}
          value={pickerFor !== null ? (bundleRows[pickerFor]?.component_id ?? '') : ''}
          allowCustom={false}
          stockFor={(i) => i.stock_qty ?? 0}
          onSelect={(id) => {
            if (pickerFor !== null) {
              setBundleRows(bundleRows.map((r, j) => (j === pickerFor ? { ...r, component_id: id } : r)))
            }
            setPickerFor(null)
          }}
        />
      </Modal>

      {confirmSheet}
    </>
  )
}
