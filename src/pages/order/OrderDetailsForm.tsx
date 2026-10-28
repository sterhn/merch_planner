import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import type { Order } from '../../lib/types'
import { DELIVERY_METHODS } from '../../lib/types'
import { formatRub, parseMoney } from '../../lib/format'
import { calculatedTotal } from '../../lib/orderLines'
import { Field, inputClass, PrimaryButton, textareaClass } from '../../components/FormField'
import { haptic } from '../../lib/haptics'

type DetailsForm = ReturnType<typeof formFor>

function formFor(order: Order) {
  return {
    telegram: order.telegram ?? '',
    customer_email: order.customer_email ?? '',
    delivery_method: order.delivery_method ?? '',
    delivery_details: order.delivery_details ?? '',
    comment: order.comment ?? '',
    shipping_fee: order.shipping_fee?.toString() ?? '',
    discount: order.discount?.toString() ?? '',
    // Before migration 010 every total was typed by hand.
    total_manual: order.total_manual ?? true,
    total_price: order.total_price?.toString() ?? '',
  }
}

const sameForm = (a: DetailsForm, b: DetailsForm) =>
  (Object.keys(a) as (keyof DetailsForm)[]).every((k) => a[k] === b[k])

// Unsaved edits per order, for this session: stepping away to another order
// or page and coming back finds them where you left them.
const drafts = new Map<string, DetailsForm>()

/** Contact fields: no auto-capitalised "@Username", no autocorrected handles. */
const HANDLE_INPUT = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const

/**
 * Contact, delivery and money for one order. The total is worked out from the
 * items (plus shipping, minus discount) unless "Set total by hand" is ticked.
 * While there are unsaved changes a bar above the tab bar says so and saves.
 */
export default function OrderDetailsForm({
  order,
  itemsTotal,
  pending,
  onSave,
}: {
  order: Order
  itemsTotal: number
  pending: boolean
  onSave: (values: Partial<Order>) => Promise<unknown>
}) {
  const [saved, setSaved] = useState(() => formFor(order))
  const [form, setForm] = useState(() => drafts.get(order.id) ?? formFor(order))
  const dirty = !sameForm(form, saved)

  useEffect(() => {
    if (dirty) drafts.set(order.id, form)
    else drafts.delete(order.id)
  }, [dirty, form, order.id])

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const shipping = parseMoney(form.shipping_fee)
  const discount = parseMoney(form.discount)
  const calculated = calculatedTotal(itemsTotal, shipping, discount)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const snapshot = form
    onSave({
      telegram: form.telegram || null,
      customer_email: form.customer_email || null,
      delivery_method: form.delivery_method || null,
      delivery_details: form.delivery_details || null,
      comment: form.comment || null,
      shipping_fee: shipping,
      discount,
      total_manual: form.total_manual,
      // The database recomputes an automatic total itself; sending the same
      // number keeps the screen right until the refetch lands.
      total_price: form.total_manual ? parseMoney(form.total_price) : calculated,
    }).then(
      () => setSaved(snapshot),
      // The failure is already on screen as a toast; the edits stay put.
      () => {},
    )
  }

  return (
    <>
      <form id="order-details" onSubmit={submit} className="rounded-card glass p-4">
        <h2 className="mb-3 font-display text-sm text-ink-muted">Details</h2>
        <div className="grid gap-x-3 md:grid-cols-2">
          <Field label="Telegram">
            <input className={inputClass} {...HANDLE_INPUT} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" inputMode="email" {...HANDLE_INPUT} value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          </Field>
        </div>
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
        <Field label="Delivery details / address">
          <textarea className={textareaClass} rows={3} value={form.delivery_details} onChange={(e) => setForm({ ...form, delivery_details: e.target.value })} />
        </Field>
        <Field label="Comment">
          <textarea className={textareaClass} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </Field>

        {/* Money fields are text, not number: a number input rejects the comma
            decimal separator a Russian keyboard produces (parseMoney handles it). */}
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Shipping ₽">
            <input className={inputClass} type="text" inputMode="decimal" value={form.shipping_fee} onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })} />
          </Field>
          <Field label="Discount ₽">
            <input className={inputClass} type="text" inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </Field>
        </div>

        <div className="mb-3 rounded-control bg-surface-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-ink-muted">Total</span>
            <span className="font-display text-lg">
              {form.total_manual ? formatRub(parseMoney(form.total_price)) : formatRub(calculated)}
            </span>
          </div>
          {!form.total_manual && (
            <p className="mt-0.5 text-right text-2xs text-ink-muted">
              items {formatRub(itemsTotal)}
              {shipping ? ` + shipping ${formatRub(shipping)}` : ''}
              {discount ? ` − discount ${formatRub(discount)}` : ''}
            </p>
          )}
          <label className="mt-2 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-brand"
              checked={form.total_manual}
              onChange={(e) =>
                setForm({
                  ...form,
                  total_manual: e.target.checked,
                  // Start the hand-typed total from the calculated one.
                  total_price: e.target.checked && !form.total_price ? String(calculated) : form.total_price,
                })
              }
            />
            Set total by hand
          </label>
          {form.total_manual && (
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              aria-label="Total ₽"
              value={form.total_price}
              onChange={(e) => setForm({ ...form, total_price: e.target.value })}
            />
          )}
        </div>

        <PrimaryButton type="submit" disabled={pending || !dirty}>
          {dirty ? 'Save details' : 'Details saved'}
        </PrimaryButton>
      </form>

      {/* Outside the glass form on purpose: a backdrop-filter ancestor would
          become the containing block for this fixed bar. */}
      {dirty && (
        <div
          role="status"
          className="glass fixed inset-x-3 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1rem)] z-20 flex animate-pop items-center gap-2 rounded-full p-1.5 pl-4 [--glass-fill:86%] md:inset-x-auto md:bottom-6 md:right-6 md:w-96 print:hidden"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-bold">Unsaved changes</span>
          <button
            type="button"
            onClick={() => {
              haptic()
              setForm(saved)
            }}
            className="tap flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-ink-muted hover:text-ink"
          >
            <Undo2 size={15} />
            Discard
          </button>
          <button
            type="submit"
            form="order-details"
            disabled={pending}
            onClick={() => haptic()}
            className="tap h-11 shrink-0 rounded-full bg-linear-to-br from-brand to-brand-2 px-5 text-sm font-extrabold text-on-brand shadow-card inset-shadow-[0_1px_0_var(--glass-gloss)] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </>
  )
}
