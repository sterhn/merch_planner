// Parses order item cell strings from the spreadsheet, e.g.
//   "брелок kdj (500 р), гробик юхён (300 р)"
//   "гача 1 крутка(150р), storypack шейкер (600р)"
// into individual { name, price } fragments.

export interface ParsedFragment {
  name: string
  price: number | null
  raw: string
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a cell on commas that are outside parentheses. */
export function splitFragments(cell: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of cell) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.map((s) => s.trim()).filter(Boolean)
}

const PRICE_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*р(?:уб)?\.?\s*\)\s*$/iu

export function parseFragment(raw: string): ParsedFragment {
  const trimmed = raw.trim()
  const m = trimmed.match(PRICE_RE)
  if (!m) {
    return { name: trimmed, price: null, raw: trimmed }
  }
  const name = trimmed.slice(0, m.index).trim()
  const price = Number(m[1].replace(',', '.'))
  return { name, price, raw: trimmed }
}

export function parseCell(cell: string | null | undefined): ParsedFragment[] {
  if (!cell || !String(cell).trim()) return []
  return splitFragments(String(cell)).map(parseFragment)
}
