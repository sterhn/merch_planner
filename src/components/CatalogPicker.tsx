import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Item } from '../lib/types'
import { formatRub } from '../lib/format'
import FilterChip from './FilterChip'
import { inputClass } from './FormField'

export default function CatalogPicker({ catalog, value, onSelect, stockFor, allowCustom = true, customLabel = '— custom item —' }: {
  catalog: Item[]
  value: string
  onSelect: (id: string) => void
  stockFor?: (item: Item) => number
  allowCustom?: boolean
  customLabel?: string
}) {
  const [search, setSearch] = useState('')
  const [fandomFilter, setFandomFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const fandoms = useMemo(() => {
    const s = new Set(catalog.map((i) => i.fandom).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [catalog])

  const types = useMemo(() => {
    const s = new Set(catalog.map((i) => i.type).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [catalog])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((i) => {
      if (fandomFilter && i.fandom !== fandomFilter) return false
      if (typeFilter && i.type !== typeFilter) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        (i.fandom ?? '').toLowerCase().includes(q) ||
        (i.type ?? '').toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [catalog, search, fandomFilter, typeFilter])

  return (
    <div>
      <div className="relative mb-2">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-9`}
        />
      </div>
      {types.length > 0 && (
        <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-1">
          {[null, ...types].map((t) => (
            <FilterChip key={t ?? '__all_types__'} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {t ?? 'All types'}
            </FilterChip>
          ))}
        </div>
      )}
      {fandoms.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {[null, ...fandoms].map((f) => (
            <FilterChip key={f ?? '__all__'} active={fandomFilter === f} tone="accent" onClick={() => setFandomFilter(f)}>
              {f ?? 'All fandoms'}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-control border border-line">
        {allowCustom && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className={`flex min-h-11 w-full items-center px-3 py-2.5 text-left text-sm italic ${value === '' ? 'bg-brand/10 font-bold text-brand' : 'text-ink-faint hover:bg-surface-2'}`}
          >
            {customLabel}
          </button>
        )}
        {filtered.map((item) => {
          const stock = stockFor?.(item)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex min-h-11 w-full items-center gap-2.5 border-t border-line px-3 py-2 text-left ${value === item.id ? 'bg-brand/10' : 'hover:bg-surface-2'} ${stock !== undefined && stock <= 0 ? 'opacity-60' : ''}`}
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="size-9 shrink-0 rounded-lg bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                {stock !== undefined && (
                  <p className={`text-[11px] ${stock <= 0 ? 'font-bold text-bad' : 'text-ink-faint'}`}>
                    {stock <= 0 ? 'out of stock' : `${stock} left`}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-display text-sm">{formatRub(item.sale_price)}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-ink-faint">No items found</p>
        )}
      </div>
    </div>
  )
}
