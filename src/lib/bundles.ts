import type { Item } from './types'

export interface BundleComponent {
  bundle_id: string
  component_id: string
  qty: number
}

export function groupBundles(rows: BundleComponent[] | undefined | null): Map<string, BundleComponent[]> {
  const m = new Map<string, BundleComponent[]>()
  for (const r of rows ?? []) {
    const arr = m.get(r.bundle_id) ?? []
    arr.push(r)
    m.set(r.bundle_id, arr)
  }
  return m
}

// How many of this bundle can be assembled from current component stock.
// Returns null when the item is not a bundle (no components defined).
export function buildableCount(
  itemId: string,
  bundles: Map<string, BundleComponent[]>,
  itemById: Map<string, Item>,
): number | null {
  const comps = bundles.get(itemId)
  if (!comps || comps.length === 0) return null
  let min = Infinity
  for (const c of comps) {
    const stock = itemById.get(c.component_id)?.stock_qty ?? 0
    min = Math.min(min, Math.floor(stock / Math.max(1, c.qty)))
  }
  return Math.max(0, min)
}

/**
 * buildableCount for every bundle, in one pass — callers rendering a list would
 * otherwise pay O(items × components) on each render.
 */
export function buildableCounts(
  bundles: Map<string, BundleComponent[]>,
  itemById: Map<string, Item>,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const bundleId of bundles.keys()) {
    const count = buildableCount(bundleId, bundles, itemById)
    if (count !== null) counts.set(bundleId, count)
  }
  return counts
}

/** "Sticker ×2 + Charm" — the component summary shown under a bundle. */
export function summarizeParts(parts: readonly { name: string; qty: number }[]): string {
  return parts.map((p) => (p.qty > 1 ? `${p.name} ×${p.qty}` : p.name)).join(' + ')
}

// The number that matters when selling: buildable count for bundles,
// plain stock for everything else.
export function effectiveStock(
  item: Item,
  bundles: Map<string, BundleComponent[]>,
  itemById: Map<string, Item>,
): number {
  return buildableCount(item.id, bundles, itemById) ?? item.stock_qty ?? 0
}
