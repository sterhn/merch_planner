// One-time import of the legacy Excel workbook into Supabase.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/import.ts path/to/workbook.xlsx [--dry-run] [--force]
//
// --dry-run  parse and print a report, insert nothing
// --force    delete existing rows first (otherwise aborts if data exists)

import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { normalizeName, parseCell } from './parse-items'

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

if (!filePath) {
  console.error('Usage: npx tsx scripts/import.ts <workbook.xlsx> [--dry-run] [--force]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !key)) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or use --dry-run).')
  process.exit(1)
}

const supabase = !dryRun ? createClient(url!, key!) : null

const SHEETS = {
  orders: 'предзаказы',
  items: 'всего мерча',
  collects: 'коллекты',
  shelf: 'полки',
}

type Row = (string | number | boolean | Date | null | undefined)[]

function str(v: Row[number]): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function num(v: Row[number]): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function bool(v: Row[number]): boolean {
  return v === true || v === 'TRUE' || v === 'True' || v === 'true' || v === 1
}

function dateStr(v: Row[number]): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const DELIVERY_METHODS = new Set(['почта', 'сдэк', 'яндекс', 'самовывоз мск', 'самовывоз спб'])

async function main() {
  const wb = XLSX.read(readFileSync(filePath!), { cellDates: true })

  function sheetRows(name: string): Row[] {
    const ws = wb.Sheets[name]
    if (!ws) {
      console.error(`Sheet "${name}" not found. Sheets: ${wb.SheetNames.join(', ')}`)
      process.exit(1)
    }
    return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null })
  }

  // ---------- 1. Catalog ----------
  const itemRows = sheetRows(SHEETS.items)
    .slice(1)
    .filter((r) => str(r[1]) != null)
    .map((r) => ({
      type: str(r[0]),
      name: str(r[1])!,
      cost_price: num(r[2]),
      sale_price: num(r[3]),
      stock_qty: num(r[5]) != null ? Math.round(num(r[5])!) : 0,
    }))
  console.log(`Catalog: ${itemRows.length} items`)

  // ---------- 2. Collects ----------
  const collectRows = sheetRows(SHEETS.collects)
    .slice(1)
    .filter((r) => str(r[0]) != null || (num(r[2]) ?? 0) > 0)
    .map((r) => ({
      name: str(r[0]),
      qty: num(r[1]) != null ? Math.round(num(r[1])!) : null,
      print_cost: num(r[2]) ?? 0,
      deadline: dateStr(r[3]),
      vendor: str(r[4]),
      commission: num(r[5]) ?? 0,
      delivery_cost: num(r[6]) ?? 0,
      paid: bool(r[7]),
    }))
  console.log(`Collects: ${collectRows.length} runs`)

  // ---------- 3. Shelf (two side-by-side shop blocks) ----------
  // Layout: col0 name, col1 price | волчок block cols 3-9 | лисья block cols 11-16
  const shelfRaw = sheetRows(SHEETS.shelf).slice(2)
  const shelfRows: {
    name: string
    price: number | null
    shop: string
    qty_sent: number
    qty_sold: number
    month: string | null
  }[] = []
  for (const r of shelfRaw) {
    const name = str(r[0])
    if (!name || /^аренда|^или месяц/i.test(name)) continue
    const price = num(r[1])
    const blocks: { shop: string; sent: Row[number]; remaining: Row[number]; sold: Row[number]; month: Row[number] }[] = [
      { shop: 'волчок', sent: r[4], remaining: r[5], sold: r[6], month: r[7] },
      { shop: 'лисья', sent: r[12], remaining: r[13], sold: r[14], month: null },
    ]
    for (const b of blocks) {
      const sold = num(b.sold) ?? 0
      const remaining = num(b.remaining)
      // "qty sent" is often blank in the sheet; reconstruct it so that
      // the generated qty_remaining (sent - sold) matches the sheet.
      const sent = num(b.sent) ?? (remaining != null ? remaining + sold : null)
      if (sent == null && sold === 0) continue
      shelfRows.push({
        name,
        price,
        shop: b.shop,
        qty_sent: sent != null ? Math.round(sent) : 0,
        qty_sold: Math.round(sold),
        month: str(b.month),
      })
    }
  }
  console.log(`Shelf: ${shelfRows.length} positions`)

  // ---------- 4. Orders ----------
  const CATEGORY_COLS: { col: number; category: string }[] = [
    { col: 2, category: 'орв' },
    { col: 3, category: 'с классы' },
    { col: 4, category: 'значки' },
    { col: 5, category: 'другое' },
  ]

  const orderRaw = sheetRows(SHEETS.orders).slice(1)
  const orders: {
    customer_email: string | null
    telegram: string | null
    total_price: number | null
    comment: string | null
    paid: boolean
    delivery_method: string | null
    delivery_details: string | null
    sent: boolean
    delivered: boolean
    lines: { name_text: string; category: string; unit_price: number | null; matched?: string }[]
  }[] = []

  let matched = 0
  let freeText = 0

  const itemLookup = new Map(itemRows.map((i) => [normalizeName(i.name), i.name]))
  function matchItem(fragmentName: string): string | undefined {
    const norm = normalizeName(fragmentName)
    if (itemLookup.has(norm)) return itemLookup.get(norm)
    // substring containment either way
    for (const [key, name] of itemLookup) {
      if (key.includes(norm) || norm.includes(key)) return name
    }
    return undefined
  }

  for (const r of orderRaw) {
    const email = str(r[0])
    const telegram = str(r[1])
    const hasItems = CATEGORY_COLS.some((c) => str(r[c.col]) != null)
    if (!email && !telegram && !hasItems) continue

    const deliveryRaw = str(r[9])?.toLowerCase() ?? null
    const lines: (typeof orders)[number]['lines'] = []
    for (const { col, category } of CATEGORY_COLS) {
      for (const frag of parseCell(str(r[col]))) {
        const m = matchItem(frag.name)
        if (m) matched++
        else freeText++
        lines.push({ name_text: frag.name, category, unit_price: frag.price, matched: m })
      }
    }

    orders.push({
      customer_email: email,
      telegram,
      total_price: num(r[6]),
      comment: str(r[7]),
      paid: bool(r[8]),
      delivery_method: deliveryRaw && DELIVERY_METHODS.has(deliveryRaw) ? deliveryRaw : null,
      delivery_details: str(r[10]),
      sent: bool(r[12]),
      delivered: bool(r[11]),
      lines,
    })
  }
  console.log(`Orders: ${orders.length} orders, line items: ${matched} matched to catalog, ${freeText} free-text`)

  if (dryRun) {
    console.log('\n--- DRY RUN REPORT ---')
    for (const o of orders) {
      const unmatchedLines = o.lines.filter((l) => !l.matched)
      if (unmatchedLines.length > 0) {
        console.log(`\n${o.telegram ?? o.customer_email ?? '(no contact)'}:`)
        for (const l of unmatchedLines) console.log(`  free-text: "${l.name_text}" (${l.unit_price ?? '?'} р) [${l.category}]`)
      }
    }
    console.log('\nDry run complete — nothing inserted.')
    return
  }

  const db = supabase!

  // Abort / wipe check
  const { count } = await db.from('orders').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    if (!force) {
      console.error(`Database already has ${count} orders. Re-run with --force to wipe and re-import.`)
      process.exit(1)
    }
    console.log('Wiping existing data (--force)…')
    for (const table of ['order_items', 'orders', 'shelf_items', 'collects', 'expenses', 'items']) {
      const { error } = await db.from(table).delete().not('id', 'is', null)
      if (error) throw error
    }
  }

  // Insert catalog and build name -> id map
  const { data: insertedItems, error: itemsErr } = await db.from('items').insert(itemRows).select('id, name')
  if (itemsErr) throw itemsErr
  const idByName = new Map(insertedItems!.map((i) => [i.name as string, i.id as string]))
  console.log(`Inserted ${insertedItems!.length} items`)

  const { error: collectsErr } = await db.from('collects').insert(collectRows)
  if (collectsErr) throw collectsErr
  console.log(`Inserted ${collectRows.length} collects`)

  const { error: shelfErr } = await db.from('shelf_items').insert(
    shelfRows.map((s) => ({ ...s, name: `[${s.shop}] ${s.name}` })),
  )
  if (shelfErr) throw shelfErr
  console.log(`Inserted ${shelfRows.length} shelf positions`)

  for (const o of orders) {
    const { lines, ...orderValues } = o
    const { data: inserted, error: orderErr } = await db.from('orders').insert(orderValues).select('id').single()
    if (orderErr) throw orderErr
    if (lines.length > 0) {
      const { error: linesErr } = await db.from('order_items').insert(
        lines.map((l) => ({
          order_id: inserted!.id,
          item_id: l.matched ? (idByName.get(l.matched) ?? null) : null,
          name_text: l.name_text,
          category: l.category,
          qty: 1,
          unit_price: l.unit_price,
        })),
      )
      if (linesErr) throw linesErr
    }
  }
  console.log(`Inserted ${orders.length} orders with line items`)
  console.log('Import complete ✔')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
