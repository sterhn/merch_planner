// SKU auto-fill for the catalog editor: FANDOM-TYPE-NN, numbered after the
// highest existing SKU with the same prefix.

import type { Item } from './types'

/** Short codes for item types (Russian type names as the catalog stores them). */
export const TYPE_ABBR: Record<string, string> = {
  'брелок': 'K', 'значок': 'B', 'карточка': 'C', 'открытка А6': 'PC',
  'открытка А5': 'PC2', 'шейкер': 'SH', 'стикеры': 'SK', 'стенд': 'ST',
  'гача': 'G', 'набор': 'SET', 'лента': 'RB', 'шоколадка': 'CH',
}

/**
 * Next free SKU for a fandom + type, e.g. MSCH-SH-04 after MSCH-SH-03.
 * Types without a code get FANDOM-01; no fandom means no suggestion ('').
 */
export function autoSku(fandom: string, type: string, items: readonly Pick<Item, 'sku'>[]): string {
  const prefix = fandom.replace(/[[\]]/g, '').toUpperCase()
  if (!prefix) return ''
  const typeCode = TYPE_ABBR[type]
  if (!typeCode) return `${prefix}-01`
  const tag = `${prefix}-${typeCode}-`
  let max = 0
  for (const i of items) {
    const s = i.sku ?? ''
    if (s.startsWith(tag)) {
      const n = parseInt(s.slice(tag.length))
      if (n > max) max = n
    }
  }
  return `${tag}${String(max + 1).padStart(2, '0')}`
}
