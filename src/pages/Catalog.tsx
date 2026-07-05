import { useMemo, useState } from 'react'
import { Plus, Search, Tags, ImageOff, X, Loader2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { uploadItemImage } from '../lib/images'
import { formatRub } from '../lib/format'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { DangerButton, Field, inputClass, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'

const EMPTY = { type: '', fandom: '', sku: '', name: '', cost_price: '', sale_price: '', stock_qty: '', image_url: '' }

export default function Catalog() {
  const { data: items, isLoading } = useList<Item>('items', { orderBy: 'type' })
  const insert = useInsert<Item>('items')
  const update = useUpdate<Item>('items')
  const remove = useDelete('items')

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items ?? []
    return (items ?? []).filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.type ?? '').toLowerCase().includes(q) ||
        (i.fandom ?? '').toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

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
      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-11`}
        />
      </div>

      {isLoading && <EmptyState icon={Loader2} spin message="Loading…" />}
      {!isLoading && filtered.length === 0 && <EmptyState icon={Tags} message="No items yet." />}

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => openEditor(item)}
            className="tap flex w-full items-center justify-between gap-3 rounded-card bg-surface p-3.5 text-left shadow-card hover:bg-brand/10"
          >
            {item.image_url ? (
              <img src={item.image_url} alt="" className="size-12 shrink-0 rounded-xl object-cover" loading="lazy" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-faint">
                <ImageOff size={18} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {[item.type, item.fandom, item.sku].filter(Boolean).join(' · ') || '—'} · cost {formatRub(item.cost_price)} · profit {formatRub(item.profit)}
              </p>
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
              <input className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="брелок / значок…" />
            </Field>
            <Field label="Fandom">
              <input className={inputClass} value={form.fandom} onChange={(e) => setForm({ ...form, fandom: e.target.value })} placeholder="kdj / tgcf…" />
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
                  if (confirm('Delete this item?')) remove.mutate(editing.id, { onSuccess: () => setEditing(null) })
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
