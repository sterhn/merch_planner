import type { Item, OrderItem } from './types'

/** Only the catalog field grouping needs, so callers can pass trimmed selects. */
type CatalogEntry = Pick<Item, 'fandom'>

export interface FandomGroup {
  /** null for custom lines and catalog items with no fandom set. */
  fandom: string | null
  lines: OrderItem[]
}

/** Heading used for the trailing group of lines without a fandom. */
export const NO_FANDOM_LABEL = 'Other'

export function fandomOf(line: OrderItem, catalog: ReadonlyMap<string, CatalogEntry>): string | null {
  const fandom = (line.item_id ? catalog.get(line.item_id) : undefined)?.fandom?.trim()
  return fandom ? fandom : null
}

/**
 * Groups order lines by the fandom of their catalog item. Lines keep the order
 * they came in (i.e. the manual line order) inside each group; groups are
 * sorted by name, with lines that have no fandom collected in a trailing group.
 */
export function groupLinesByFandom(
  lines: OrderItem[],
  catalog: ReadonlyMap<string, CatalogEntry>,
): FandomGroup[] {
  const groups = new Map<string, OrderItem[]>()
  const loose: OrderItem[] = []

  for (const line of lines) {
    const fandom = fandomOf(line, catalog)
    if (!fandom) {
      loose.push(line)
      continue
    }
    const bucket = groups.get(fandom)
    if (bucket) bucket.push(line)
    else groups.set(fandom, [line])
  }

  const sorted: FandomGroup[] = [...groups.entries()]
    // ru collation so Cyrillic fandom names sort the way the catalog shows them.
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([fandom, grouped]) => ({ fandom, lines: grouped }))

  if (loose.length > 0) sorted.push({ fandom: null, lines: loose })
  return sorted
}
