// Past customers by Telegram handle, for the new-order suggestions.

import type { Order } from './types'

export interface KnownCustomer {
  /** The handle as last typed. */
  handle: string
  /** How many orders it's on. */
  count: number
  /** created_at of their latest order. */
  last: string
}

/**
 * One entry per Telegram handle (case-insensitive), in the order the orders
 * come — pass them newest first and the latest spelling and date win.
 */
export function knownCustomers(orders: readonly Pick<Order, 'telegram' | 'created_at'>[]): KnownCustomer[] {
  const seen = new Map<string, KnownCustomer>()
  for (const o of orders) {
    const handle = o.telegram?.trim()
    if (!handle) continue
    const key = handle.toLowerCase()
    const known = seen.get(key)
    if (known) known.count += 1
    else seen.set(key, { handle, count: 1, last: o.created_at })
  }
  return [...seen.values()]
}

/** The known customer whose handle is exactly what's typed (ignoring case and spaces). */
export function findCustomer(customers: readonly KnownCustomer[], typed: string): KnownCustomer | undefined {
  const key = typed.trim().toLowerCase()
  return key ? customers.find((c) => c.handle.toLowerCase() === key) : undefined
}
