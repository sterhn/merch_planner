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

/** A SKU's fandom part: the fandom without brackets or spaces, upper-cased. */
function fandomPrefix(fandom: string): string {
  return fandom.replace(/[[\]\s]/g, '').toUpperCase()
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
  const prefix = fandomPrefix(fandom)
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

/**
 * How a SKU strays from the convention nextSku hands out, as readable
 * reasons; empty when it follows it, or when there's no SKU to judge. Its
 * prefix must be the item's fandom, and when the type has a code, the SKU must
 * carry that code — the drift an item picks up when its fandom or type is
 * changed after the SKU was set. A type without a code may carry any code (it's
 * a type waiting for TYPE_ABBR, not a wrong SKU), and an item without a fandom
 * has no prefix to check against.
 */
export function skuIssues(item: { sku: string | null; type: string | null; fandom: string | null }): string[] {
  if (!item.sku?.trim()) return []
  const parts = /^(\S+?)-(?:([A-Z][A-Z0-9]*)-)?(\d{2,})$/.exec(item.sku)
  if (!parts) return ['not in FANDOM-TYPE-NN form']
  const [, prefix, code] = parts
  const issues: string[] = []
  const wantPrefix = item.fandom ? fandomPrefix(item.fandom) : ''
  if (wantPrefix && prefix !== wantPrefix) issues.push(`starts ${prefix}, but the fandom is ${wantPrefix}`)
  const wantCode = item.type ? TYPE_ABBR[item.type] : undefined
  if (wantCode && code !== wantCode) {
    issues.push(code ? `type code ${code}, but ${item.type} is ${wantCode}` : `no type code (${item.type} is ${wantCode})`)
  }
  return issues
}
