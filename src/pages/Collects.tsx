import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer, AlertTriangle, PackageCheck, Truck, Wallet } from 'lucide-react'
import type { Collect, CollectItem, Item } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub, todayISO } from '../lib/format'
import { collectsView, saveCollectsView } from '../lib/viewState'
import FilterChip from '../components/FilterChip'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SkeletonRows } from '../components/Skeleton'
import { SECTIONS } from '../components/sections'
import { useLaunchFlag } from '../hooks/useLaunchFlag'
import SearchInput from '../components/SearchInput'
import StatusBadge from '../components/StatusBadge'
import { AddButton } from '../components/FormField'
import { haptic } from '../lib/haptics'
import CollectEditor from './collects/CollectEditor'

type StatusFilter = 'all' | 'unpaid' | 'pending' | 'received'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'To pay' },
  { key: 'pending', label: 'Not received' },
  { key: 'received', label: 'Received' },
]

function matchesStatus(c: Collect, filter: StatusFilter): boolean {
  switch (filter) {
    case 'unpaid':
      return !c.paid
    case 'pending':
      return !c.received_at
    case 'received':
      return Boolean(c.received_at)
    case 'all':
      return true
  }
}

/** A small date chip: red when the date has passed and still matters. */
function DateChip({ icon: Icon, label, date, late }: { icon: typeof Wallet; label: string; date: string; late: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        late ? 'bg-bad/10 text-bad' : 'bg-surface-2 text-ink-muted'
      }`}
    >
      {late ? <AlertTriangle size={12} /> : <Icon size={12} />}
      {label} {formatDate(date)}
    </span>
  )
}

export default function Collects() {
  const { data: collects, isLoading, isError, refetch } = useList<Collect>('collects', {
    orderBy: 'deadline',
    ascending: false,
    // Undated runs have no deadline to be urgent about, so they belong at the
    // bottom rather than at the top where Postgres would put them.
    nullsFirst: false,
  })
  const { data: collectItems } = useList<CollectItem>('collect_items')
  const { data: items } = useList<Item>('items', { orderBy: 'name' })

  // Search and filter come back from the last visit, like the Orders list.
  const [search, setSearch] = useState(() => collectsView().search)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = collectsView().status
    return STATUS_FILTERS.some((f) => f.key === saved) ? (saved as StatusFilter) : 'all'
  })
  const launchNew = useLaunchFlag()
  const [editing, setEditing] = useState<Collect | 'new' | null>(launchNew ? 'new' : null)

  // `?open=<id>` (from the dashboard or an expense row) opens that collect —
  // once its positions have loaded, since the editor starts from them.
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  // Remembered so the link can't reopen the sheet in the moment between
  // closing it and the URL losing its ?open.
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const linked =
    openId && openId !== dismissedId && editing === null && collectItems
      ? collects?.find((c) => c.id === openId)
      : undefined
  const current = editing ?? linked ?? null

  function closeEditor() {
    setEditing(null)
    if (openId) {
      setDismissedId(openId)
      setSearchParams(
        (p) => {
          p.delete('open')
          return p
        },
        { replace: true },
      )
    }
  }

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items ?? []) m.set(i.id, i)
    return m
  }, [items])

  const positionsByCollect = useMemo(() => {
    const m = new Map<string, CollectItem[]>()
    for (const r of collectItems ?? []) {
      const arr = m.get(r.collect_id) ?? []
      arr.push(r)
      m.set(r.collect_id, arr)
    }
    return m
  }, [collectItems])

  function positionLabel(p: CollectItem): string {
    const name = (p.item_id ? itemById.get(p.item_id)?.name : null) ?? p.name_text ?? '—'
    return p.qty > 1 ? `${name} ×${p.qty}` : name
  }

  const today = todayISO()

  // Months of runs accumulate; search covers name, vendor and position names.
  // Search narrows the pool; the status chips then split it, each showing how
  // many it would leave (like the Orders list).
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return collects ?? []
    return (collects ?? []).filter((c) => {
      const positionNames = (positionsByCollect.get(c.id) ?? [])
        .map((p) => ((p.item_id ? itemById.get(p.item_id)?.name : null) ?? p.name_text ?? ''))
        .join(' ')
      return `${c.name ?? ''} ${c.vendor ?? ''} ${positionNames}`.toLowerCase().includes(q)
    })
  }, [collects, search, positionsByCollect, itemById])

  const counts = useMemo(() => {
    const out = {} as Record<StatusFilter, number>
    for (const f of STATUS_FILTERS) out[f.key] = pool.filter((c) => matchesStatus(c, f.key)).length
    return out
  }, [pool])

  const filtered = useMemo(() => pool.filter((c) => matchesStatus(c, statusFilter)), [pool, statusFilter])

  // Still owed across every collect, whatever the filter.
  const toPay = useMemo(() => {
    const unpaid = (collects ?? []).filter((c) => !c.paid)
    return { count: unpaid.length, total: unpaid.reduce((s, c) => s + (c.total_cost ?? 0), 0) }
  }, [collects])

  return (
    <div>
      <PageHeader
        title="Collects"
        subtitle={toPay.count > 0 ? `${formatRub(toPay.total)} still to pay on ${toPay.count}` : undefined}
        icon={SECTIONS.collects.icon}
        tone={SECTIONS.collects.tone}
      >
        <AddButton onClick={() => setEditing('new')} data-shortcut="new" title="Shortcut: N">Add collect</AddButton>
      </PageHeader>

      <SearchInput
        className="mb-3"
        label="Search collects"
        placeholder="Search name, vendor or positions…"
        value={search}
        onChange={(value) => {
          setSearch(value)
          saveCollectsView({ search: value })
        }}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            active={statusFilter === f.key}
            onClick={() => {
              setStatusFilter(f.key)
              saveCollectsView({ status: f.key })
            }}
            count={counts[f.key]}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={filtered.length === 0}
        icon={Printer}
        tone={SECTIONS.collects.tone}
        skeleton={<SkeletonRows rows={3} />}
        errorMessage="Failed to load collects."
        emptyMessage={(collects ?? []).length === 0 ? 'No production runs yet.' : 'No collects match.'}
        onRetry={() => void refetch()}
      />

      <div className="space-y-2">
        {filtered.map((c) => {
          // Payment matters until it's paid; arrival until it's received.
          const payLate = !c.paid && c.deadline != null && c.deadline < today
          const arriveLate = !c.received_at && c.arrives_by != null && c.arrives_by < today
          const rowPositions = positionsByCollect.get(c.id) ?? []
          return (
            <button
              key={c.id}
              onClick={() => {
                haptic()
                setEditing(c)
              }}
              className={`lift flex w-full items-center justify-between gap-3 rounded-card glass p-3.5 text-left ${
                payLate || arriveLate ? 'glass-alert' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{c.name ?? '—'}</p>
                <p className="text-xs text-ink-muted">
                  {c.vendor ?? '—'} · {c.qty ?? '?'} pcs · {formatRub(c.cost_per_unit)}/pc
                </p>
                {rowPositions.length > 0 && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-brand">
                    {rowPositions.map(positionLabel).join(' + ')}
                  </p>
                )}
                {(c.deadline || c.arrives_by) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.deadline && !c.paid && <DateChip icon={Wallet} label="pay by" date={c.deadline} late={payLate} />}
                    {c.arrives_by && !c.received_at && (
                      <DateChip icon={Truck} label="arrives" date={c.arrives_by} late={arriveLate} />
                    )}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 font-display text-sm">{formatRub(c.total_cost)}</p>
                <StatusBadge on={c.paid} label="paid" />
                {c.received_at && (
                  <p className="mt-1 flex items-center justify-end gap-1 text-xs font-bold text-good">
                    <PackageCheck size={12} />
                    received
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {current !== null && (
        <CollectEditor
          key={current === 'new' ? 'new' : current.id}
          collect={current}
          positions={current === 'new' ? [] : (positionsByCollect.get(current.id) ?? [])}
          items={items ?? []}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
