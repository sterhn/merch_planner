import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardPaste, History, ImageDown, Layers, Loader2, MessageSquareText, PackageSearch, Printer, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Item, Order, OrderItem } from '../lib/types'
import { useDelete, useList, useUpdate } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import { renderOrderImage, shareOrderImage } from '../lib/orderImage'
import { haptic } from '../lib/haptics'
import { showToast } from '../lib/toast'
import { effectiveStock, groupBundles, type BundleComponent } from '../lib/bundles'
import { calculatedTotal, groupLinesByFandom, linesTotal, NO_FANDOM_LABEL, sortLinesByPrice } from '../lib/orderLines'
import { openPrintWindow, receiptPageHtml, singleOrderPageHtml } from '../lib/printOrder'
import { fandomGrouping, rememberOrder, setFandomGrouping } from '../lib/viewState'
import StatusBadge from '../components/StatusBadge'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import { AddButton, DangerButton, IconButton } from '../components/FormField'
import OrderDetailsForm from './order/OrderDetailsForm'
import { AddLineSheet, EditLineSheet, ImportSheet } from './order/LineSheets'
import MessagesSheet from './order/MessagesSheet'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: order, isError: orderMissing } = useQuery({
    queryKey: ['orders', id],
    queryFn: async (): Promise<Order> => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Order
    },
    enabled: Boolean(id),
  })

  const {
    data: lines,
    isLoading: linesLoading,
    isError: linesError,
    refetch: refetchLines,
  } = useQuery({
    queryKey: ['order_items', id],
    queryFn: async (): Promise<OrderItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id!)
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at')
      if (error) throw error
      return data as OrderItem[]
    },
    enabled: Boolean(id),
  })

  // Other orders from the same customer (case-insensitive match on the same
  // contact field; % _ \ escaped so ilike treats them literally).
  const contactField = order?.telegram ? 'telegram' : order?.customer_email ? 'customer_email' : null
  const contactValue = order?.telegram || order?.customer_email || ''
  const { data: pastOrders } = useQuery({
    queryKey: ['orders', 'by-contact', contactField, contactValue, id],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .neq('id', id!)
        .ilike(contactField!, contactValue.replace(/[\\%_]/g, '\\$&'))
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Order[]
    },
    enabled: Boolean(id && contactField),
  })

  const { data: catalog } = useList<Item>('items', { orderBy: 'name' })
  const { data: rawBundles } = useList<BundleComponent>('bundle_items', {
    select: 'bundle_id, component_id, qty',
  })
  // Invalidate 'items' too: marking an order sent changes catalog stock (DB trigger).
  const updateOrder = useUpdate<Order>('orders', ['items'])
  const deleteOrder = useDelete('orders')
  // The Orders list embeds order_items for its thumbnails and item-name search,
  // and the database recomputes the total — so line writes refresh orders too.
  // 'items' as well: a line change on a sent order moves stock (migration 010).
  const deleteLine = useDelete('order_items', ['orders', 'items'])
  const { confirm, element: confirmSheet } = useConfirm()

  const [addingLine, setAddingLine] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editingLine, setEditingLine] = useState<OrderItem | null>(null)
  const [importing, setImporting] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [grouping, setGrouping] = useState(fandomGrouping)

  // Lets the Orders screen offer a jump back into the order you had open.
  useEffect(() => {
    if (order) rememberOrder(order.id, order.telegram || order.customer_email || 'Order')
  }, [order])

  const itemNames = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of catalog ?? []) map.set(i.id, i)
    return map
  }, [catalog])

  const bundleGroups = useMemo(() => groupBundles(rawBundles), [rawBundles])
  // Retired items stay readable on old lines but aren't offered for new ones.
  const pickable = useMemo(() => (catalog ?? []).filter((i) => !i.archived), [catalog])

  // Items always read priciest first, grouped or not.
  const orderedLines = useMemo(() => sortLinesByPrice(lines ?? []), [lines])
  const fandomGroups = useMemo(() => groupLinesByFandom(lines ?? [], itemNames), [lines, itemNames])

  const itemsTotal = useMemo(
    () => linesTotal(lines),
    [lines],
  )

  // Next free position for appended lines; falls back to the index for rows
  // created before positions existed.
  const nextPosition = useMemo(
    () => (lines ?? []).reduce((m, l, i) => Math.max(m, (l.position ?? i) + 1), 0),
    [lines],
  )

  // Grouping is only worth offering when the order spans several fandoms.
  const canGroup = fandomGroups.length > 1
  const grouped = grouping && canGroup

  if (orderMissing)
    return (
      <div>
        <EmptyState icon={PackageSearch} tone="accent" message="Order not found" hint="It may have been deleted." />
        <div className="text-center">
          <button
            onClick={() => navigate('/orders')}
            className="tap min-h-11 rounded-full px-4 text-sm font-bold text-brand hover:bg-brand/10"
          >
            ← Back to orders
          </button>
        </div>
      </div>
    )

  if (!order) return <EmptyState icon={Loader2} spin message="Loading…" />

  // Before migration 010 every total was typed by hand.
  const manualTotal = order.total_manual ?? true
  const calculated = calculatedTotal(itemsTotal, order.shipping_fee, order.discount)

  function toggle(flag: 'paid' | 'sent' | 'delivered') {
    // Optimistic: flip the badge immediately, roll back if the save fails.
    const previous = qc.getQueryData<Order>(['orders', id])
    qc.setQueryData<Order>(['orders', id], (o) => (o ? { ...o, [flag]: !o[flag] } : o))
    updateOrder.mutate(
      { id: id!, values: { [flag]: !order![flag] } },
      { onError: () => qc.setQueryData(['orders', id], previous) },
    )
  }

  async function exportImage() {
    haptic()
    setExporting(true)
    try {
      const blobs = await renderOrderImage(order!, orderedLines, itemNames, { groupByFandom: grouped })
      const safeName = (order!.telegram || order!.customer_email || 'order').replace(/[^\w@.а-яё-]+/gi, '_')
      const result = await shareOrderImage(blobs, safeName)
      if (result === 'saved') showToast(blobs.length > 1 ? `${blobs.length} images saved` : 'Image saved')
    } catch {
      showToast('Could not create the image')
    } finally {
      setExporting(false)
    }
  }

  function openLineEdit(l: OrderItem) {
    haptic()
    setEditingLine(l)
  }

  function printOrder() {
    // The printout follows the on-screen grouping toggle.
    openPrintWindow(singleOrderPageHtml(order!, orderedLines, itemNames, grouped ? fandomGroups : null))
  }

  function printReceipt() {
    openPrintWindow(receiptPageHtml(order!, orderedLines, itemNames))
  }

  function renderLine(l: OrderItem) {
    const catalogItem = l.item_id ? itemNames.get(l.item_id) : undefined
    // Imported lines carry the store's type; manual lines fall back to the
    // catalog item's type so the note shows either way.
    const note = l.category ?? catalogItem?.type
    return (
      <li key={l.id} className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => openLineEdit(l)}
          className="tap flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
          aria-label={`Edit ${catalogItem?.name ?? l.name_text ?? 'item'}`}
        >
          {catalogItem?.image_url
            ? <img src={catalogItem.image_url} alt="" className="size-8 shrink-0 rounded-lg object-cover" loading="lazy" />
            : <div className="size-8 shrink-0 rounded-lg bg-surface-2" />
          }
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {catalogItem?.name ?? l.name_text ?? '—'}
              {l.qty > 1 && <span className="text-ink-muted"> ×{l.qty}</span>}
            </p>
            {note && <p className="text-xs text-ink-faint">{note}</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold">{formatRub(l.unit_price)}</span>
        </button>
        <IconButton
          icon={Trash2}
          size={10}
          tone="danger"
          label={`Remove ${catalogItem?.name ?? l.name_text ?? 'item'}`}
          className="print:hidden"
          onClick={() => confirm('Remove this item?', () => deleteLine.mutate(l.id))}
        />
      </li>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="tap -ml-2 mb-3 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-brand print:hidden"
      >
        <ArrowLeft size={16} />
        Back to orders
      </button>

      <PageHeader title={order.telegram || order.customer_email || 'Order'}>
        <IconButton
          icon={MessageSquareText}
          label="Message to customer"
          onClick={() => {
            haptic()
            setMessaging(true)
          }}
          className="print:hidden"
        />
        <IconButton
          icon={exporting ? Loader2 : ImageDown}
          label="Share as image"
          onClick={exportImage}
          disabled={exporting}
          className={`print:hidden ${exporting ? '[&_svg]:animate-spin' : ''}`}
        />
        <IconButton icon={Printer} label="Print / PDF" onClick={printOrder} className="print:hidden" />
        <IconButton icon={Receipt} label="Receipt" onClick={printReceipt} className="print:hidden" />
        <span className="font-display text-lg">{formatRub(order.total_price)}</span>
      </PageHeader>

      <div className="mb-5 flex gap-2 *:flex-1 print:hidden">
        <StatusBadge on={order.paid} label="paid" onClick={() => toggle('paid')} />
        <StatusBadge on={order.sent} label="sent" onClick={() => toggle('sent')} />
        <StatusBadge on={order.delivered} label="delivered" onClick={() => toggle('delivered')} />
      </div>

      <section className="mb-6 rounded-card glass p-4">
        {/* Wraps as a whole on narrow screens or at large font sizes, so the
            button labels never break across two lines. */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h2 className="font-display text-sm text-ink-muted">Items</h2>
          <div className="flex flex-wrap items-center justify-end gap-1 print:hidden">
            {canGroup && (
              <button
                onClick={() => {
                  haptic()
                  setGrouping(!grouping)
                  setFandomGrouping(!grouping)
                }}
                aria-pressed={grouping}
                aria-label="Group items by fandom"
                title={grouping ? 'Ungroup items' : 'Group items by fandom'}
                className={`tap flex size-11 shrink-0 items-center justify-center rounded-full ${grouping ? 'text-accent' : 'text-ink-muted'}`}
              >
                <Layers size={15} />
              </button>
            )}
            <button
              onClick={() => setImporting(true)}
              className="tap flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-bold text-ink-muted"
            >
              <ClipboardPaste size={15} />
              Import
            </button>
            <AddButton onClick={() => setAddingLine(true)}>Add item</AddButton>
          </div>
        </div>
        {/* A failed fetch must not read as an empty order — re-saving over
            what merely looks like no items would be destructive. */}
        {linesError ? (
          <p className="py-3 text-sm font-semibold text-bad">
            Failed to load items.{' '}
            <button
              type="button"
              onClick={() => void refetchLines()}
              className="tap font-bold text-brand underline decoration-dotted"
            >
              Retry
            </button>
          </p>
        ) : (
          (lines ?? []).length === 0 && (
            <p className="py-3 text-sm text-ink-faint">{linesLoading ? 'Loading…' : 'No items.'}</p>
          )
        )}
        {grouped ? (
          <div>
            {fandomGroups.map((g) => (
              <div key={g.fandom ?? '__no_fandom__'}>
                <div className="flex items-center gap-2 pb-0.5 pt-2.5">
                  <h3 className="font-display text-xs font-bold text-accent">{g.fandom ?? NO_FANDOM_LABEL}</h3>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <ul className="divide-y divide-line">{g.lines.map(renderLine)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">{orderedLines.map(renderLine)}</ul>
        )}
        {(lines ?? []).length > 0 && (
          <div className="mt-2 text-right">
            <p className="font-display text-xs text-ink-muted">items total: {formatRub(itemsTotal)}</p>
            {order.shipping_fee ? (
              <p className="text-xs text-ink-muted">+ shipping {formatRub(order.shipping_fee)}</p>
            ) : null}
            {order.discount ? <p className="text-xs text-ink-muted">− discount {formatRub(order.discount)}</p> : null}
            {/* A hand-typed total that no longer matches what the items add up to. */}
            {manualTotal && Math.abs((order.total_price ?? 0) - calculated) > 0.005 && (
              <p className="mt-1 text-xs font-semibold text-ink-muted print:hidden">
                total set by hand · calculated would be {formatRub(calculated)} ·{' '}
                <button
                  onClick={() => updateOrder.mutate({ id: id!, values: { total_manual: false, total_price: calculated } })}
                  disabled={updateOrder.isPending}
                  className="tap font-bold text-brand underline decoration-dotted disabled:opacity-50"
                >
                  use calculated
                </button>
              </p>
            )}
          </div>
        )}
      </section>

      {(pastOrders?.length ?? 0) > 0 && (
        <section className="mb-6 rounded-card glass p-4 print:hidden">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-display text-sm text-ink-muted">
              <History size={14} />
              Previous orders
            </h2>
            <span className="shrink-0 text-xs text-ink-faint">
              {pastOrders!.length} · {formatRub(pastOrders!.reduce((s, p) => s + (p.total_price ?? 0), 0))}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {pastOrders!.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link to={`/orders/${p.id}`} className="tap flex min-h-11 items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatDate(p.created_at)}</p>
                    <div className="mt-0.5">
                      <OrderStatus paid={p.paid} sent={p.sent} delivered={p.delivered} />
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm">{formatRub(p.total_price)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {pastOrders!.length > 5 && (
            <p className="mt-1 text-xs text-ink-faint">and {pastOrders!.length - 5} more…</p>
          )}
        </section>
      )}

      <div className="print:hidden">
        {/* Re-keyed when the total switches between automatic and by-hand,
            so the form picks up the new mode. Not on total_price: that
            changes with every line edit and would wipe unsaved details. */}
        <OrderDetailsForm
          key={`${order.id}-${manualTotal}`}
          order={order}
          itemsTotal={itemsTotal}
          pending={updateOrder.isPending}
          onSave={(values) => updateOrder.mutate({ id: id!, values })}
        />

        <div className="mt-4">
          <DangerButton
            onClick={() =>
              confirm('Delete this whole order?', () =>
                deleteOrder.mutate(id!, { onSuccess: () => navigate('/orders') }),
              )
            }
          >
            Delete order
          </DangerButton>
        </div>
      </div>

      <AddLineSheet
        open={addingLine}
        onClose={() => setAddingLine(false)}
        orderId={id!}
        catalog={pickable}
        itemNames={itemNames}
        stockFor={(item) => effectiveStock(item, bundleGroups, itemNames)}
        nextPosition={nextPosition}
      />

      {editingLine && (
        <EditLineSheet key={editingLine.id} line={editingLine} itemNames={itemNames} onClose={() => setEditingLine(null)} />
      )}

      <MessagesSheet
        open={messaging}
        onClose={() => setMessaging(false)}
        order={order}
        lines={lines ?? []}
        catalog={itemNames}
      />

      <ImportSheet open={importing} onClose={() => setImporting(false)} orderId={id!} nextPosition={nextPosition} />

      {confirmSheet}
    </div>
  )
}
