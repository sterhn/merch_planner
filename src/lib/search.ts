// "Search everything": which orders, catalog items and collects match a query.
// Kept apart from the component (and the Supabase client) so it's testable.

import type { Collect, Item, OrderWithPhotos } from './types'

export interface SearchResults {
  /** Orders from a matching customer first, then orders containing a matching item. */
  orders: OrderWithPhotos[]
  /** By name, SKU, fandom or type. */
  items: Item[]
  /** By name or vendor. */
  collects: Collect[]
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()

export function searchAll(
  query: string,
  data: { orders?: readonly OrderWithPhotos[]; items?: readonly Item[]; collects?: readonly Collect[] },
): SearchResults {
  const q = query.trim().toLowerCase()
  if (!q) return { orders: [], items: [], collects: [] }

  const byContact: OrderWithPhotos[] = []
  const byItem: OrderWithPhotos[] = []
  for (const o of data.orders ?? []) {
    if (`${norm(o.telegram)} ${norm(o.customer_email)}`.includes(q)) byContact.push(o)
    else if ((o.order_items ?? []).some((oi) => norm(oi.item?.name ?? oi.name_text).includes(q))) byItem.push(o)
  }

  return {
    orders: [...byContact, ...byItem],
    items: (data.items ?? []).filter((i) =>
      [i.name, i.sku, i.fandom, i.type].some((field) => norm(field).includes(q)),
    ),
    collects: (data.collects ?? []).filter((c) => [c.name, c.vendor].some((field) => norm(field).includes(q))),
  }
}
