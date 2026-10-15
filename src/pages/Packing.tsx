import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, MapPin, PackageCheck, Send } from 'lucide-react'
import type { Item, Order, OrderItem } from '../lib/types'
import { supabase } from '../lib/supabase'
import { useList, useUpdate } from '../hooks/useTable'
import { chunk, fetchAllPages } from '../lib/paging'
import { pickList, pruneTicks } from '../lib/packing'
import { packingTicks, savePackingTicks, type PackingTicks } from '../lib/viewState'
import { sortLinesByPrice } from '../lib/orderLines'
import { celebrate } from '../lib/confetti'
import { haptic } from '../lib/haptics'
import { showToast } from '../lib/toast'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import QueryState from '../components/QueryState'
import { SECTIONS } from '../components/sections'
import { PrimaryButton, SecondaryButton } from '../components/FormField'

/** A tickable row: the whole row is the label, so the tap target is the full width. */
function TickRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className={`tap flex min-h-11 cursor-pointer items-center gap-3 py-1.5 ${checked ? 'opacity-55' : ''}`}>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-brand"
        checked={checked}
        onChange={(e) => {
          haptic(5)
          onChange(e.target.checked)
        }}
      />
      {children}
    </label>
  )
}

/**
 * Packing day for the "To send" list: a pick list of everything the orders
 * need (added up per item), then each order to tick off line by line and
 * mark sent. Ticks are remembered on this device until the order is sent.
 */
export default function Packing() {
  const navigate = useNavigate()
  const ordersQ = useList<Order>('orders', { orderBy: 'created_at' })
  const { data: catalog } = useList<Item>('items')
  // Invalidate 'items' too: marking an order sent changes catalog stock (DB trigger).
  const update = useUpdate<Order>('orders', ['items'])

  const toSend = useMemo(() => (ordersQ.data ?? []).filter((o) => o.paid && !o.sent), [ordersQ.data])
  const ids = useMemo(() => toSend.map((o) => o.id), [toSend])

  // Keyed under 'order_items' so any line edit elsewhere refreshes it.
  const linesQ = useQuery({
    queryKey: ['order_items', 'packing', ids],
    queryFn: async (): Promise<OrderItem[]> => {
      const batches = await Promise.all(
        chunk(ids, 80).map((batch) =>
          fetchAllPages(async (from, to) => {
            const { data, error } = await supabase
              .from('order_items')
              .select('*')
              .in('order_id', batch)
              .order('id')
              .range(from, to)
            if (error) throw error
            return data as OrderItem[]
          }),
        ),
      )
      return batches.flat()
    },
    enabled: ids.length > 0,
  })

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of catalog ?? []) m.set(i.id, i)
    return m
  }, [catalog])

  const lines = useMemo(() => linesQ.data ?? [], [linesQ.data])
  const linesByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>()
    for (const l of lines) m.set(l.order_id, [...(m.get(l.order_id) ?? []), l])
    return m
  }, [lines])
  const picks = useMemo(() => pickList(lines, itemById), [lines, itemById])

  const [ticks, setTicks] = useState<PackingTicks>(packingTicks)
  // Ticks for orders that have since been sent (or lines since removed) drop out.
  const packed = useMemo(() => new Set(pruneTicks(ticks.packed, lines.map((l) => l.id))), [ticks.packed, lines])
  const picked = useMemo(() => new Set(pruneTicks(ticks.picked, picks.map((p) => p.key))), [ticks.picked, picks])

  function setTick(kind: keyof PackingTicks, key: string, on: boolean) {
    const current = kind === 'packed' ? packed : picked
    const next = on ? [...current, key] : [...current].filter((k) => k !== key)
    setTicks((t) => ({ ...t, [kind]: next }))
    savePackingTicks({ [kind]: next })
  }

  function markSent(order: Order, who: string) {
    celebrate()
    update.mutate({ id: order.id, values: { sent: true } })
    showToast(`${who} marked sent`, {
      label: 'Undo',
      onClick: () => update.mutate({ id: order.id, values: { sent: false } }),
    })
  }

  const units = lines.reduce((s, l) => s + l.qty, 0)
  const pickedUnits = picks.filter((p) => picked.has(p.key)).reduce((s, p) => s + p.qty, 0)
  const loading = ordersQ.isLoading || (ids.length > 0 && linesQ.isLoading)

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="tap -ml-2 mb-3 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} />
        Back to orders
      </button>

      <PageHeader
        title="Packing"
        subtitle={toSend.length > 0 ? `${toSend.length} order${toSend.length !== 1 ? 's' : ''} · ${units} item${units !== 1 ? 's' : ''}` : undefined}
        icon={PackageCheck}
        tone={SECTIONS.orders.tone}
      />

      <QueryState
        isLoading={loading}
        isError={ordersQ.isError || linesQ.isError}
        isEmpty={toSend.length === 0}
        icon={PackageCheck}
        tone="sun"
        errorMessage="Failed to load the orders to pack."
        emptyMessage="Nothing to pack!"
        emptyHint="Paid orders waiting to be sent show up here."
        onRetry={() => {
          void ordersQ.refetch()
          void linesQ.refetch()
        }}
      />

      {!loading && !ordersQ.isError && !linesQ.isError && toSend.length > 0 && (
        <div className="space-y-3">
          <Card
            title="Pick list"
            action={
              <span className="text-xs font-bold text-ink-muted">
                {pickedUnits} / {units} picked
              </span>
            }
          >
            <div className="divide-y divide-line">
              {picks.map((p) => (
                <TickRow key={p.key} checked={picked.has(p.key)} onChange={(on) => setTick('picked', p.key, on)}>
                  {p.image ? (
                    <img src={p.image} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="size-9 shrink-0 rounded-lg bg-surface-2" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${picked.has(p.key) ? 'line-through' : ''}`}>
                      {p.name}
                    </span>
                    <span className="block truncate text-2xs text-ink-faint">
                      {[p.fandom, p.orders > 1 ? `${p.orders} orders` : null].filter(Boolean).join(' · ') || ' '}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-base">×{p.qty}</span>
                </TickRow>
              ))}
            </div>
          </Card>

          {toSend.map((o) => {
            const who = o.telegram || o.customer_email || 'no contact'
            const orderLines = sortLinesByPrice(linesByOrder.get(o.id) ?? [])
            const done = orderLines.filter((l) => packed.has(l.id)).length
            const complete = orderLines.length > 0 && done === orderLines.length
            return (
              <Card key={o.id} className={complete ? '[--glass-fill:88%]' : ''}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/orders/${o.id}`} className="block truncate text-base font-bold text-ink hover:underline">
                      {who}
                    </Link>
                    <p className="text-xs font-semibold text-ink-muted">{o.delivery_method ?? 'no delivery method'}</p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      complete ? 'bg-good/10 text-good' : 'bg-surface-2 text-ink-muted'
                    }`}
                  >
                    {complete && <Check size={13} strokeWidth={3} />}
                    {done} / {orderLines.length} packed
                  </span>
                </div>
                {o.delivery_details && (
                  <p className="mb-1 flex items-start gap-1.5 text-xs text-ink-muted">
                    <MapPin size={13} className="mt-px shrink-0" />
                    <span className="whitespace-pre-wrap">{o.delivery_details}</span>
                  </p>
                )}
                {o.comment && <p className="mb-1 text-xs italic text-ink-faint">Note: {o.comment}</p>}
                <div className="divide-y divide-line">
                  {orderLines.map((l) => (
                    <TickRow key={l.id} checked={packed.has(l.id)} onChange={(on) => setTick('packed', l.id, on)}>
                      <span className={`min-w-0 flex-1 truncate text-sm ${packed.has(l.id) ? 'line-through' : ''}`}>
                        {(l.item_id ? itemById.get(l.item_id)?.name : null) ?? l.name_text ?? '—'}
                      </span>
                      <span className="shrink-0 text-sm font-bold">×{l.qty}</span>
                    </TickRow>
                  ))}
                  {orderLines.length === 0 && <p className="py-2 text-sm text-ink-faint">No items on this order.</p>}
                </div>
                <div className="mt-2">
                  {complete ? (
                    <PrimaryButton onClick={() => markSent(o, who)} disabled={update.isPending}>
                      <span className="flex items-center justify-center gap-2">
                        <Send size={16} />
                        Packed — mark sent
                      </span>
                    </PrimaryButton>
                  ) : (
                    <SecondaryButton
                      className="w-full"
                      onClick={() => markSent(o, who)}
                      disabled={update.isPending}
                    >
                      <Send size={15} />
                      Mark sent
                    </SecondaryButton>
                  )}
                </div>
              </Card>
            )
          })}

          {(packed.size > 0 || picked.size > 0) && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  haptic()
                  setTicks({ packed: [], picked: [] })
                  savePackingTicks({ packed: [], picked: [] })
                }}
                className="tap min-h-11 rounded-full px-4 text-sm font-bold text-ink-faint hover:text-ink"
              >
                Clear all ticks
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
