import type { OrderItem } from './types'

// The store page's cart share ends with a machine-readable tail:
//   Привет! Хочу заказать: … ---
//   import:[{"id":"…","name":"…","type":"…","qty":1,"price":650}]
// This parser accepts the whole message, just the import:[...] tail, or a bare
// JSON array, so it works for both the Import modal and the PWA share target.

export interface ImportedLine {
  id?: string
  name?: string
  type?: string
  qty?: number
  price?: number | null
}

function tryParse(json: string): ImportedLine[] | null {
  try {
    const arr: unknown = JSON.parse(json)
    if (!Array.isArray(arr) || arr.length === 0) return null
    return arr as ImportedLine[]
  } catch {
    return null
  }
}

export function parseImportCode(text: string): ImportedLine[] | null {
  const greedy = /import:\s*(\[[\s\S]*\])/.exec(text)
  if (greedy) {
    // Greedy first (JSON strings may contain ']'), lazy as a fallback for
    // trailing text after the code.
    const lazy = /import:\s*(\[[\s\S]*?\])/.exec(text)
    return tryParse(greedy[1]) ?? (lazy ? tryParse(lazy[1]) : null)
  }
  const trimmed = text.trim()
  return trimmed.startsWith('[') ? tryParse(trimmed) : null
}

export function importedOrderRows(orderId: string, lines: ImportedLine[]): Partial<OrderItem>[] {
  return lines.map((line) => ({
    order_id: orderId,
    item_id: line.id || null,
    name_text: line.name || null,
    category: line.type || null,
    qty: line.qty ?? 1,
    unit_price: line.price ?? null,
  }))
}

/** Sum of the shared cart, or null when no line has a price. */
export function importedTotal(lines: ImportedLine[]): number | null {
  const priced = lines.filter((l) => l.price != null)
  if (priced.length === 0) return null
  return priced.reduce((s, l) => s + l.price! * (l.qty ?? 1), 0)
}
