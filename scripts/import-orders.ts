// Import orders, collects, and shelf positions from the legacy workbook,
// matching order line items against the CURRENT Supabase items table
// (not the legacy "всего мерча" sheet).
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/import-orders.ts path/to/workbook.xlsx [--dry-run] [--force]
//
// --dry-run  parse and report unmatched items, insert nothing
// --force    wipe existing orders/collects/shelf before import

import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { normalizeName, parseCell } from './parse-items'

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

if (!filePath) {
  console.error('Usage: npx tsx scripts/import-orders.ts <workbook.xlsx> [--dry-run] [--force]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !key)) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const db = !dryRun ? createClient(url!, key!) : null

type Cell = (string | number | boolean | Date | null | undefined)[]

function str(v: Cell[number]): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function num(v: Cell[number]): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
function bool(v: Cell[number]): boolean {
  return v === true || v === 'TRUE' || v === 'True' || v === 'true' || v === 1
}
function dateStr(v: Cell[number]): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const DELIVERY_METHODS = new Set(['почта', 'сдэк', 'яндекс', 'самовывоз мск', 'самовывоз спб'])

const SHEETS = { orders: 'предзаказы', collects: 'коллекты', shelf: 'полки' }

async function main() {
  const wb = XLSX.read(readFileSync(filePath!), { cellDates: true })

  function sheetRows(name: string): Cell[] {
    const ws = wb.Sheets[name]
    if (!ws) { console.error(`Sheet "${name}" not found`); process.exit(1) }
    return XLSX.utils.sheet_to_json<Cell>(ws, { header: 1, defval: null })
  }

  // --- 1. Collects ---
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
  console.log(`Collects: ${collectRows.length}`)

  // --- 2. Shelf ---
  const shelfRaw = sheetRows(SHEETS.shelf).slice(2)
  const shelfRows: { name: string; price: number | null; shop: string; qty_sent: number; qty_sold: number; month: string | null }[] = []
  for (const r of shelfRaw) {
    const name = str(r[0])
    if (!name || /^аренда|^или месяц/i.test(name)) continue
    const price = num(r[1])
    const blocks = [
      { shop: 'волчок', sent: r[4], remaining: r[5], sold: r[6], month: r[7] },
      { shop: 'лисья', sent: r[12], remaining: r[13], sold: r[14], month: null as Cell[number] },
    ]
    for (const b of blocks) {
      const sold = num(b.sold) ?? 0
      const remaining = num(b.remaining)
      const sent = num(b.sent) ?? (remaining != null ? remaining + sold : null)
      if (sent == null && sold === 0) continue
      shelfRows.push({ name, price, shop: b.shop, qty_sent: sent != null ? Math.round(sent) : 0, qty_sold: Math.round(sold), month: str(b.month) })
    }
  }
  console.log(`Shelf: ${shelfRows.length}`)

  // --- 3. Orders (matched against current Supabase catalog) ---
  const existingItems = dryRun
    ? []
    : (await db!.from('items').select('id, name').then(({ data, error }) => { if (error) throw error; return data! }))

  const itemLookup = new Map(existingItems.map((i) => [normalizeName(i.name), i.name]))
  const idByName = new Map(existingItems.map((i) => [i.name, i.id]))

  function matchItem(fragmentName: string): string | undefined {
    const norm = normalizeName(fragmentName)
    if (itemLookup.has(norm)) return itemLookup.get(norm)
    for (const [key, name] of itemLookup) {
      if (key.includes(norm) || norm.includes(key)) return name
    }
    return undefined
  }

  const CATEGORY_COLS = [
    { col: 2, category: 'орв' },
    { col: 3, category: 'с классы' },
    { col: 4, category: 'значки' },
    { col: 5, category: 'другое' },
  ]

  const orderRaw = sheetRows(SHEETS.orders).slice(1)
  const orders: {
    customer_email: string | null; telegram: string | null; total_price: number | null
    comment: string | null; paid: boolean; delivery_method: string | null
    delivery_details: string | null; sent: boolean; delivered: boolean
    lines: { name_text: string; category: string; unit_price: number | null; matched?: string }[]
  }[] = []

  let matched = 0, freeText = 0
  for (const r of orderRaw) {
    const email = str(r[0]), telegram = str(r[1])
    const hasItems = CATEGORY_COLS.some((c) => str(r[c.col]) != null)
    if (!email && !telegram && !hasItems) continue
    const deliveryRaw = str(r[9])?.toLowerCase() ?? null
    const lines: (typeof orders)[number]['lines'] = []
    for (const { col, category } of CATEGORY_COLS) {
      for (const frag of parseCell(str(r[col]))) {
        const m = matchItem(frag.name)
        if (m) matched++; else freeText++
        lines.push({ name_text: frag.name, category, unit_price: frag.price, matched: m })
      }
    }
    orders.push({
      customer_email: email, telegram, total_price: num(r[6]), comment: str(r[7]),
      paid: bool(r[8]),
      delivery_method: deliveryRaw && DELIVERY_METHODS.has(deliveryRaw) ? deliveryRaw : null,
      delivery_details: str(r[10]), sent: bool(r[12]), delivered: bool(r[11]),
      lines,
    })
  }
  console.log(`Orders: ${orders.length} (${matched} matched, ${freeText} free-text)`)

  if (dryRun) {
    console.log('\n--- DRY RUN: unmatched line items ---')
    for (const o of orders) {
      const unmatched = o.lines.filter((l) => !l.matched)
      if (unmatched.length) {
        console.log(`\n${o.telegram ?? o.customer_email ?? '(no contact)'}:`)
        for (const l of unmatched) console.log(`  free-text: "${l.name_text}" (${l.unit_price ?? '?'} р) [${l.category}]`)
      }
    }
    console.log('\nDry run complete — nothing inserted.')
    return
  }

  // --- Wipe check ---
  const { count } = await db!.from('orders').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    if (!force) {
      console.error(`DB already has ${count} orders. Re-run with --force to wipe and re-import.`)
      process.exit(1)
    }
    console.log(`Wiping existing data (--force)…`)
    for (const table of ['order_items', 'orders', 'shelf_items', 'collects']) {
      const { error } = await db!.from(table).delete().not('id', 'is', null)
      if (error) throw error
    }
  }

  // --- Insert ---
  const { error: collectsErr } = await db!.from('collects').insert(collectRows)
  if (collectsErr) throw collectsErr
  console.log(`Inserted ${collectRows.length} collects`)

  const { error: shelfErr } = await db!.from('shelf_items').insert(
    shelfRows.map((s) => ({ ...s, name: `[${s.shop}] ${s.name}` })),
  )
  if (shelfErr) throw shelfErr
  console.log(`Inserted ${shelfRows.length} shelf positions`)

  for (const o of orders) {
    const { lines, ...orderValues } = o
    const { data: inserted, error: orderErr } = await db!.from('orders').insert(orderValues).select('id').single()
    if (orderErr) throw orderErr
    if (lines.length > 0) {
      const { error: linesErr } = await db!.from('order_items').insert(
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

main().catch((err) => { console.error(err); process.exit(1) })
