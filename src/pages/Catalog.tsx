import { useMemo, useState } from 'react'
import { Archive, Tags } from 'lucide-react'
import type { Item } from '../lib/types'
import { useList } from '../hooks/useTable'
import { useSettings } from '../hooks/useSettings'
import { buildableCounts, groupBundles, summarizeParts, type BundleComponent } from '../lib/bundles'
import { formatRub } from '../lib/format'
import { catalogView, saveCatalogView } from '../lib/viewState'
import Modal from '../components/Modal'
import FilterChip from '../components/FilterChip'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SECTIONS } from '../components/sections'
import { useLaunchFlag } from '../hooks/useLaunchFlag'
import SearchInput from '../components/SearchInput'
import { AddButton, PrimaryButton } from '../components/FormField'
import { haptic } from '../lib/haptics'
import ItemEditor from './catalog/ItemEditor'

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
  const { settings } = useSettings()

  // Filters come back from the last visit, like the Orders list.
  const [view, setView] = useState(catalogView)
  const updateView = (patch: Partial<typeof view>) => {
    setView((v) => ({ ...v, ...patch }))
    saveCatalogView(patch)
  }
  const launchNew = useLaunchFlag()
  const [editing, setEditing] = useState<Item | 'new' | null>(launchNew ? 'new' : null)
  const [viewing, setViewing] = useState<Item | null>(null)

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items ?? []) m.set(i.id, i)
    return m
  }, [items])

  const bundleGroups = useMemo(() => groupBundles(rawBundles), [rawBundles])

  // Precomputed once per data change: the list used to recompute this per item,
  // per render, walking every component each time.
  const canMakeById = useMemo(() => buildableCounts(bundleGroups, itemById), [bundleGroups, itemById])

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

  const archivedCount = useMemo(() => (items ?? []).filter((i) => i.archived).length, [items])
  // Leaving the archive view once it's empty (the last item was restored).
  const showArchived = view.archived && archivedCount > 0

  const filtered = useMemo(() => {
    const q = view.search.trim().toLowerCase()
    return (items ?? []).filter((i) => {
      if (Boolean(i.archived) !== showArchived) return false
      if (view.type && i.type !== view.type) return false
      if (view.fandom && i.fandom !== view.fandom) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        (i.type ?? '').toLowerCase().includes(q) ||
        (i.fandom ?? '').toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, view, showArchived])

  function openEditor(item: Item | 'new') {
    setEditing(item)
  }

  return (
    <div>
      <PageHeader title="Catalog" icon={SECTIONS.catalog.icon} tone={SECTIONS.catalog.tone}>
        <AddButton onClick={() => openEditor('new')}>Add item</AddButton>
      </PageHeader>
      <SearchInput className="mb-3" label="Search catalog" value={view.search} onChange={(search) => updateView({ search })} />

      {(types.length > 0 || archivedCount > 0) && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={view.type === null} onClick={() => updateView({ type: null })}>All types</FilterChip>
          {types.map((t) => (
            <FilterChip key={t} active={view.type === t} onClick={() => updateView({ type: view.type === t ? null : t })}>{t}</FilterChip>
          ))}
          {archivedCount > 0 && (
            <FilterChip active={showArchived} onClick={() => updateView({ archived: !showArchived })} count={archivedCount}>
              <span className="flex items-center gap-1">
                <Archive size={13} />
                Archived
              </span>
            </FilterChip>
          )}
        </div>
      )}

      {fandoms.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={view.fandom === null} onClick={() => updateView({ fandom: null })}>All fandoms</FilterChip>
          {fandoms.map((f) => (
            <FilterChip key={f} active={view.fandom === f} onClick={() => updateView({ fandom: view.fandom === f ? null : f })}>{f}</FilterChip>
          ))}
        </div>
      )}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={filtered.length === 0}
        icon={Tags}
        tone={SECTIONS.catalog.tone}
        errorMessage="Failed to load catalog."
        emptyMessage={(items ?? []).length === 0 ? 'No items yet.' : 'No items match.'}
        onRetry={() => void refetch()}
      />

      <div className="space-y-2">
        {filtered.map((item) => {
          const canMake = canMakeById.get(item.id) ?? null
          const parts = bundleMap.get(item.id) ?? []
          const stockShown = canMake ?? item.stock_qty ?? 0
          return (
            <div key={item.id} className="flex w-full items-center gap-3 rounded-card glass p-3.5">
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
                onClick={() => {
                  haptic()
                  openEditor(item)
                }}
                className="tap flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {[item.type, item.fandom, item.sku].filter(Boolean).join(' · ') || '—'} · cost {formatRub(item.cost_price)} · profit {formatRub(item.profit)}
                  </p>
                  {parts.length > 0 && (
                    <p className="mt-0.5 truncate text-xs font-semibold text-brand">{summarizeParts(parts)}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm">{formatRub(item.sale_price)}</p>
                  <p
                    className={`text-xs font-semibold ${
                      !item.archived && stockShown <= settings.lowStockThreshold ? 'text-bad' : 'text-ink-faint'
                    }`}
                  >
                    {canMake !== null ? `can make: ${canMake}` : `stock: ${stockShown}`}
                  </p>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {editing !== null && (
        <ItemEditor
          key={editing === 'new' ? 'new' : editing.id}
          item={editing}
          items={items ?? []}
          rawBundles={rawBundles ?? []}
          types={types}
          fandoms={fandoms}
          onClose={() => setEditing(null)}
        />
      )}

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
                {summarizeParts(bundleMap.get(viewing.id) ?? [])}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-sm text-ink-muted">
                cost {formatRub(viewing.cost_price)} · profit {formatRub(viewing.profit)} ·{' '}
                {canMakeById.has(viewing.id)
                  ? `can make ${canMakeById.get(viewing.id)}`
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
