import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardPaste, History, ImageDown, Layers, Loader2, PackageSearch, Printer, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Item, Order, OrderItem } from '../lib/types'
import { DELIVERY_METHODS } from '../lib/types'
import { useDelete, useInsert, useList, useUpdate } from '../hooks/useTable'
import { formatDate, formatRub, parseCount, parseMoney } from '../lib/format'
import { importedOrderRows, parseImportCode } from '../lib/importCode'
import { renderOrderImage, shareOrderImage } from '../lib/orderImage'
import { haptic } from '../lib/haptics'
import { showToast } from '../lib/toast'
import { effectiveStock, groupBundles, type BundleComponent } from '../lib/bundles'
import { groupLinesByFandom, linesTotal, NO_FANDOM_LABEL, sortLinesByPrice } from '../lib/orderLines'
import { esc, ITEM_TABLE_HEAD, itemRowsHtml, openPrintWindow, POPUP_BLOCKED, printPageHtml, RECEIPT_CSS, receiptBodyHtml, SINGLE_ORDER_CSS, statusParts } from '../lib/printOrder'
import { fandomGrouping, rememberOrder, setFandomGrouping } from '../lib/viewState'
import StatusBadge from '../components/StatusBadge'
import { useConfirm } from '../hooks/useConfirm'
import CatalogPicker from '../components/CatalogPicker'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import OrderStatus from '../components/OrderStatus'
import PageHeader from '../components/PageHeader'
import {
  AddButton,
  DangerButton,
  Field,
  IconButton,
  inputClass,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from '../components/FormField'

function HeaderForm({
  order,
  pending,
  onSave,
}: {
  order: Order
  pending: boolean
  onSave: (values: Partial<Order>) => void
}) {
  const [form, setForm] = useState({
    telegram: order.telegram ?? '',
    customer_email: order.customer_email ?? '',
    total_price: order.total_price?.toString() ?? '',
    delivery_method: order.delivery_method ?? '',
    delivery_details: order.delivery_details ?? '',
    comment: order.comment ?? '',
  })

  // "use items total" rewrites the total from outside the form. Take the new
  // value into that one field; the form used to remount for it instead, which
  // threw away anything typed into the other fields and not yet saved.
  const [syncedTotal, setSyncedTotal] = useState(order.total_price)
  if (order.total_price !== syncedTotal) {
    setSyncedTotal(order.total_price)
    setForm((f) => ({ ...f, total_price: order.total_price?.toString() ?? '' }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      telegram: form.telegram || null,
      customer_email: form.customer_email || null,
      total_price: parseMoney(form.total_price),
      delivery_method: form.delivery_method || null,
      delivery_details: form.delivery_details || null,
      comment: form.comment || null,
    })
  }

  return (
    <form onSubmit={submit} className="rounded-card glass p-4">
      <h2 className="mb-3 font-display text-sm text-ink-muted">Details</h2>
      <div className="grid gap-x-3 md:grid-cols-2">
        <Field label="Telegram">
          <input className={inputClass} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
        </Field>
        {/* Money fields are text, not number: a number input rejects the comma
            decimal separator a Russian keyboard produces (parseMoney handles it). */}
        <Field label="Total ₽">
          <input className={inputClass} type="text" inputMode="decimal" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} />
        </Field>
        <Field label="Delivery method">
          <select className={inputClass} value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}>
            <option value="">—</option>
            {DELIVERY_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Delivery details / address">
        <textarea className={textareaClass} rows={3} value={form.delivery_details} onChange={(e) => setForm({ ...form, delivery_details: e.target.value })} />
      </Field>
      <Field label="Comment">
        <textarea className={textareaClass} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      </Field>
      <PrimaryButton type="submit" disabled={pending}>
        Save details
      </PrimaryButton>
    </form>
  )
}

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
  // so line writes have to refresh it too.
  const insertLine = useInsert<OrderItem>('order_items', ['orders'])
  const deleteLine = useDelete('order_items', ['orders'])

  const updateLine = useUpdate<OrderItem>('order_items')
  const { confirm, element: confirmSheet } = useConfirm()

  const [addingLine, setAddingLine] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lineForm, setLineForm] = useState({ item_id: '', name_text: '', qty: '1', unit_price: '' })
  const [editingLine, setEditingLine] = useState<OrderItem | null>(null)
  const [editForm, setEditForm] = useState({ name_text: '', qty: '1', unit_price: '' })
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
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

  function toggle(flag: 'paid' | 'sent' | 'delivered') {
    // Optimistic: flip the badge immediately, roll back if the save fails.
    const previous = qc.getQueryData<Order>(['orders', id])
    qc.setQueryData<Order>(['orders', id], (o) => (o ? { ...o, [flag]: !o[flag] } : o))
    updateOrder.mutate(
      { id: id!, values: { [flag]: !order![flag] } },
      { onError: () => qc.setQueryData(['orders', id], previous) },
    )
  }

  function addLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // "Add & next" keeps the sheet open, so a many-item order isn't a
    // reopen-the-sheet round trip per line.
    const another = (e.nativeEvent as SubmitEvent).submitter?.dataset.next === '1'
    const picked = lineForm.item_id ? itemNames.get(lineForm.item_id) : undefined
    insertLine.mutate(
      {
        order_id: id!,
        item_id: lineForm.item_id || null,
        name_text: lineForm.name_text || picked?.name || null,
        category: picked?.type ?? null,
        qty: parseCount(lineForm.qty, 1) ?? 1,
        unit_price: parseMoney(lineForm.unit_price) ?? picked?.sale_price ?? null,
        position: nextPosition,
      },
      {
        onSuccess: () => {
          setLineForm({ item_id: '', name_text: '', qty: '1', unit_price: '' })
          if (another) showToast(`Added ${picked?.name || lineForm.name_text || 'item'}`)
          else setAddingLine(false)
        },
      },
    )
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setImportError('')

    const items = parseImportCode(importText)
    if (!items) {
      setImportError('Could not parse. Paste the import:[...] code (or the whole message) from the store page.')
      return
    }

    const rows = importedOrderRows(id!, items, nextPosition)

    setImportBusy(true)
    try {
      const { error } = await supabase.from('order_items').insert(rows)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['order_items'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      setImporting(false)
      setImportText('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportBusy(false)
    }
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
    setEditForm({ name_text: l.name_text ?? '', qty: String(l.qty), unit_price: l.unit_price?.toString() ?? '' })
    setEditingLine(l)
  }

  function saveLineEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLine) return
    updateLine.mutate(
      {
        id: editingLine.id,
        values: {
          ...(editingLine.item_id ? {} : { name_text: editForm.name_text || null }),
          qty: parseCount(editForm.qty, 1) ?? 1,
          unit_price: parseMoney(editForm.unit_price),
        },
      },
      { onSuccess: () => setEditingLine(null) },
    )
  }

  function printOrder() {
    const customerName = order!.telegram || order!.customer_email || 'Order'
    const date = formatDate(order!.created_at)

    // The printout follows the on-screen grouping toggle.
    const itemRows = itemRowsHtml(orderedLines, itemNames, grouped ? fandomGroups : null)

    const extraInfo = [
      order!.delivery_method ? `<p><strong>Delivery:</strong> ${esc(order!.delivery_method)}</p>` : '',
      order!.delivery_details ? `<p><strong>Address:</strong> ${esc(order!.delivery_details)}</p>` : '',
      order!.customer_email ? `<p><strong>Email:</strong> ${esc(order!.customer_email)}</p>` : '',
      order!.comment ? `<p><strong>Comment:</strong> ${esc(order!.comment)}</p>` : '',
    ].filter(Boolean).join('')

    const html = printPageHtml(
      `Order – ${customerName}`,
      SINGLE_ORDER_CSS,
      `<h1>${esc(customerName)}</h1>
  <div class="date">${date}</div>
  <div class="status">${statusParts(order!).join('<span style="color:#ccc"> | </span>')}</div>
  <table>
    <thead>
      ${ITEM_TABLE_HEAD}
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="items-total">Items total: ${formatRub(itemsTotal)}</div>
  ${order!.total_price != null ? `<div class="order-total">Order total: ${formatRub(order!.total_price)}</div>` : ''}
  ${extraInfo ? `<div class="info">${extraInfo}</div>` : ''}`,
    )

    if (!openPrintWindow(html)) showToast(POPUP_BLOCKED)
  }

  function printReceipt() {
    const html = printPageHtml(
      `Receipt – ${order!.telegram || order!.customer_email || 'Order'}`,
      RECEIPT_CSS,
      receiptBodyHtml(order!, orderedLines, itemNames),
    )
    if (!openPrintWindow(html)) showToast(POPUP_BLOCKED)
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
            {Math.abs((order.total_price ?? 0) - itemsTotal) > 0.005 && (
              <p className="mt-1 text-xs font-semibold text-ink-muted print:hidden">
                differs from order total {formatRub(order.total_price)} ·{' '}
                <button
                  onClick={() =>
                    updateOrder.mutate({ id: id!, values: { total_price: itemsTotal } })
                  }
                  disabled={updateOrder.isPending}
                  className="tap font-bold text-brand underline decoration-dotted disabled:opacity-50"
                >
                  use items total
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
        <HeaderForm
          key={order.id}
          order={order}
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

      <Modal title="Add item" open={addingLine} onClose={() => setAddingLine(false)}>
        <form onSubmit={addLine}>
          <Field label="From catalog">
            <CatalogPicker
              catalog={catalog ?? []}
              value={lineForm.item_id}
              stockFor={(item) => effectiveStock(item, bundleGroups, itemNames)}
              onSelect={(id) => {
                const picked = itemNames.get(id)
                setLineForm({
                  ...lineForm,
                  item_id: id,
                  unit_price: picked?.sale_price?.toString() ?? lineForm.unit_price,
                })
              }}
            />
          </Field>
          {!lineForm.item_id && (
            <Field label="Custom name">
              <input className={inputClass} value={lineForm.name_text} onChange={(e) => setLineForm({ ...lineForm, name_text: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty">
              <input className={inputClass} type="number" min="1" inputMode="numeric" value={lineForm.qty} onChange={(e) => setLineForm({ ...lineForm, qty: e.target.value })} />
            </Field>
            <Field label="Unit price ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={lineForm.unit_price} onChange={(e) => setLineForm({ ...lineForm, unit_price: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <SecondaryButton type="submit" data-next="1" disabled={insertLine.isPending} className="h-12 shrink-0">
              Add &amp; next
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={insertLine.isPending}>
              Add
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal title="Edit item" open={Boolean(editingLine)} onClose={() => setEditingLine(null)}>
        <form onSubmit={saveLineEdit}>
          {editingLine?.item_id ? (
            <p className="mb-3 truncate text-sm font-semibold">
              {itemNames.get(editingLine.item_id)?.name ?? editingLine.name_text ?? '—'}
            </p>
          ) : (
            <Field label="Name">
              <input className={inputClass} value={editForm.name_text} onChange={(e) => setEditForm({ ...editForm, name_text: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty">
              <input className={inputClass} type="number" min="1" inputMode="numeric" value={editForm.qty} onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })} />
            </Field>
            <Field label="Unit price ₽">
              <input className={inputClass} type="text" inputMode="decimal" value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })} />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={updateLine.isPending}>
            Save
          </PrimaryButton>
        </form>
      </Modal>

      <Modal title="Import items" open={importing} onClose={() => { setImporting(false); setImportError('') }}>
        <form onSubmit={handleImport}>
          <Field label="Paste order code">
            <textarea
              className={textareaClass}
              rows={5}
              placeholder='import:[{"id":"...","name":"...","qty":1,"price":650}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </Field>
          {importError && <p className="mb-3 text-sm font-semibold text-bad">{importError}</p>}
          <PrimaryButton type="submit" disabled={importBusy || !importText.trim()}>
            {importBusy ? 'Importing…' : 'Import'}
          </PrimaryButton>
        </form>
      </Modal>

      {confirmSheet}
    </div>
  )
}
