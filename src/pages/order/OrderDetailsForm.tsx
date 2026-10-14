import { useState } from 'react'
import type { Order } from '../../lib/types'
import { DELIVERY_METHODS } from '../../lib/types'
import { formatRub, parseMoney } from '../../lib/format'
import { calculatedTotal } from '../../lib/orderLines'
import { Field, inputClass, PrimaryButton, textareaClass } from '../../components/FormField'

/**
 * Contact, delivery and money for one order. The total is worked out from the
 * items (plus shipping, minus discount) unless "Set total by hand" is ticked.
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
  onSave: (values: Partial<Order>) => void
}) {
  const [form, setForm] = useState({
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
  })

  const shipping = parseMoney(form.shipping_fee)
  const discount = parseMoney(form.discount)
  const calculated = calculatedTotal(itemsTotal, shipping, discount)

  function submit(e: React.FormEvent) {
    e.preventDefault()
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
          <p className="mt-0.5 text-right text-2xs text-ink-faint">
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

      <PrimaryButton type="submit" disabled={pending}>
        Save details
      </PrimaryButton>
    </form>
  )
}
