// Catalog list orderings. Russian collation throughout, so Cyrillic names
// sort the way they read.

import type { Item } from './types'

export const CATALOG_SORTS = [
  { key: 'type', label: 'Type' },
  { key: 'name', label: 'Name' },
  { key: 'stock', label: 'Stock (low first)' },
  { key: 'price', label: 'Price (high first)' },
  { key: 'newest', label: 'Newest' },
] as const

export type CatalogSort = (typeof CATALOG_SORTS)[number]['key']

export function isCatalogSort(value: unknown): value is CatalogSort {
  return CATALOG_SORTS.some((s) => s.key === value)
}

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, 'ru')

/**
 * `stockOf` is the stock the row shows — for a bundle, how many can be made
 * from its parts — so "low first" surfaces what actually needs restocking.
 * Ties fall back to the name, so the order never jitters between renders.
 */
export function sortCatalog(items: readonly Item[], sort: CatalogSort, stockOf: (item: Item) => number): Item[] {
  const rows = [...items]
  switch (sort) {
    case 'name':
      return rows.sort(byName)
    case 'stock':
      return rows.sort((a, b) => stockOf(a) - stockOf(b) || byName(a, b))
    case 'price':
      return rows.sort((a, b) => (b.sale_price ?? -1) - (a.sale_price ?? -1) || byName(a, b))
    case 'newest':
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b))
    case 'type':
      // Untyped items last.
      return rows.sort(
        (a, b) =>
          (a.type == null ? 1 : 0) - (b.type == null ? 1 : 0) ||
          (a.type ?? '').localeCompare(b.type ?? '', 'ru') ||
          byName(a, b),
      )
  }
}
