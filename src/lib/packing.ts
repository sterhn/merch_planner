// Packing day: everything the "To send" orders need, added up per item (the
// pick list), plus helpers for ticking lines off order by order.

import type { Item, OrderItem } from './types'

export interface PickRow {
  /** item id, or "name:<text>" for custom lines. */
  key: string
  name: string
  qty: number
  fandom: string | null
  image: string | null
  /** How many orders need it. */
  orders: number
}

type PickCatalog = ReadonlyMap<string, Pick<Item, 'name' | 'fandom' | 'image_url'>>

export function pickKey(line: Pick<OrderItem, 'item_id' | 'name_text'>): string {
  return line.item_id ?? `name:${(line.name_text ?? '').trim().toLowerCase()}`
}

/**
 * One row per distinct item across the lines, quantities summed. Grouped by
 * fandom (custom lines last), then by name — the order things sit on a shelf.
 */
export function pickList(lines: readonly OrderItem[], catalog: PickCatalog): PickRow[] {
  const rows = new Map<string, PickRow & { orderIds: Set<string> }>()
  for (const line of lines) {
    const key = pickKey(line)
    const item = line.item_id ? catalog.get(line.item_id) : undefined
    let row = rows.get(key)
    if (!row) {
      row = {
        key,
        name: item?.name ?? line.name_text ?? '—',
        qty: 0,
        fandom: item?.fandom?.trim() || null,
        image: item?.image_url ?? null,
        orders: 0,
        orderIds: new Set(),
      }
      rows.set(key, row)
    }
    row.qty += line.qty
    row.orderIds.add(line.order_id)
  }
  return [...rows.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size }))
    .sort(
      (a, b) =>
        (a.fandom == null ? 1 : 0) - (b.fandom == null ? 1 : 0) ||
        (a.fandom ?? '').localeCompare(b.fandom ?? '', 'ru') ||
        a.name.localeCompare(b.name, 'ru'),
    )
}

/** Drops ticks that no longer point at anything on the list (sent orders, deleted lines). */
export function pruneTicks(ticks: readonly string[], live: Iterable<string>): string[] {
  const keep = new Set(live)
  return ticks.filter((t) => keep.has(t))
}
