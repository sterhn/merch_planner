/** Short codes for the catalog's item types, as used in SKUs (MSCH-SH-04). */
export const TYPE_ABBR: Readonly<Record<string, string>> = {
  'брелок': 'K',
  'значок': 'B',
  'карточка': 'C',
  'открытка А6': 'PC',
  'открытка А5': 'PC2',
  'шейкер': 'SH',
  'стикеры': 'SK',
  'стенд': 'ST',
  'гача': 'G',
  'набор': 'SET',
  'лента': 'RB',
  'шоколадка': 'CH',
}

/**
 * The next free SKU for a fandom and type: FANDOM-TYPE-NN when the type has a
 * code, FANDOM-NN when it doesn't, numbered one past the highest SKU already
 * in that series. Empty when there's no fandom to take a prefix from.
 *
 * Both series count up from what exists — the code-less one used to return
 * FANDOM-01 every time, so a second such item got a duplicate SKU.
 */
export function nextSku(fandom: string, type: string, taken: readonly (string | null)[]): string {
  const prefix = fandom.replace(/[[\]]/g, '').trim().toUpperCase()
  if (!prefix) return ''
  const code = TYPE_ABBR[type]
  const series = code ? `${prefix}-${code}-` : `${prefix}-`
  let max = 0
  for (const sku of taken) {
    if (!sku?.startsWith(series)) continue
    const tail = sku.slice(series.length)
    // Only a bare number counts, so MSCH-SH-01 doesn't look like part of MSCH-NN.
    if (/^\d+$/.test(tail)) max = Math.max(max, Number(tail))
  }
  return `${series}${String(max + 1).padStart(2, '0')}`
}
