// The order screen's details form, as data: what its fields hold, what saving
// them would change, and how it follows the order changing underneath it.
// Lives outside OrderDetail.tsx so its test runs without the Supabase client.

import { dateInputValue, localNoonISO, parseMoney } from './format'
import type { Order } from './types'

/** The details form's fields for an order, as its inputs hold them. */
export function detailsForm(order: Order) {
  return {
    telegram: order.telegram ?? '',
    customer_email: order.customer_email ?? '',
    total_price: order.total_price?.toString() ?? '',
    paid_at: dateInputValue(order.paid_at),
    delivery_method: order.delivery_method ?? '',
    delivery_details: order.delivery_details ?? '',
    comment: order.comment ?? '',
  }
}

export type DetailsForm = ReturnType<typeof detailsForm>

/**
 * What saving the form would change on the order: only the fields that
 * differ. So an untouched paid date is never sent — before migration 010 the
 * column doesn't exist, and re-sending a date would move its time to noon.
 */
export function detailsChanges(form: DetailsForm, order: Order): Partial<Order> {
  const next: Partial<Order> = {
    telegram: form.telegram || null,
    customer_email: form.customer_email || null,
    total_price: parseMoney(form.total_price),
    delivery_method: form.delivery_method || null,
    delivery_details: form.delivery_details || null,
    comment: form.comment || null,
  }
  const changes = Object.fromEntries(
    Object.entries(next).filter(([key, value]) => value !== order[key as keyof Order]),
  ) as Partial<Order>
  if (form.paid_at && form.paid_at !== dateInputValue(order.paid_at)) changes.paid_at = localNoonISO(form.paid_at)
  return changes
}

/**
 * The form after the order changed from `base` to `server` underneath it:
 * fields left untouched take the new value, typed ones stay. The total and the
 * paid date always take it — here they change only by an explicit action
 * ("use items total", marking paid), which must win over a stale entry.
 */
export function followServer(form: DetailsForm, base: DetailsForm, server: DetailsForm): DetailsForm {
  const next = { ...form }
  for (const key of Object.keys(server) as (keyof DetailsForm)[]) {
    const forced = key === 'total_price' || key === 'paid_at'
    if (server[key] !== base[key] && (forced || form[key] === base[key])) next[key] = server[key]
  }
  return next
}
