// Import catalog items from the new-format Excel sheet.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/import-catalog.ts path/to/catalog.xlsx [--dry-run] [--force]
//
// --dry-run  parse and print rows, insert nothing
// --force    delete existing items first (otherwise aborts if items exist)
//
// Expected sheet: "Catalog"
// Columns: SKU | TYPE | FANDOM | NAME | FORMAT/FINISH | COST ₽ | PRICE ₽ | STOCK

import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

if (!filePath) {
  console.error('Usage: npx tsx scripts/import-catalog.ts <catalog.xlsx> [--dry-run] [--force]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !key)) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or use --dry-run).')
  process.exit(1)
}

type Cell = string | number | boolean | Date | null | undefined

function str(v: Cell): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' || s.toUpperCase() === 'TBD' ? null : s
}

function num(v: Cell): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'string' && v.trim().toUpperCase() === 'TBD') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

async function main() {
  const wb = XLSX.read(readFileSync(filePath!), { cellDates: true })

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'catalog') ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.error(`No sheet found. Available: ${wb.SheetNames.join(', ')}`)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null })
  // Skip header row
  const dataRows = rows.slice(1).filter((r) => str(r[3]) != null)

  const items = dataRows.map((r) => ({
    sku: str(r[0]),
    type: str(r[1]),
    fandom: str(r[2]),
    name: str(r[3])!,
    cost_price: num(r[5]),
    sale_price: num(r[6]),
    stock_qty: num(r[7]) != null ? Math.round(num(r[7])!) : 0,
  }))

  console.log(`Parsed ${items.length} items from sheet "${sheetName}"`)

  if (dryRun) {
    console.log('\n--- DRY RUN ---')
    for (const item of items) {
      console.log(
        `  [${item.sku ?? '—'}] ${item.fandom ?? ''} ${item.name} | ${item.type} | cost:${item.cost_price ?? '?'} sale:${item.sale_price ?? '?'} stock:${item.stock_qty}`,
      )
    }
    console.log('\nDry run complete — nothing inserted.')
    return
  }

  const supabase = createClient(url!, key!)

  const { count } = await supabase.from('items').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    if (!force) {
      console.error(
        `Database already has ${count} items. Re-run with --force to wipe and re-import.`,
      )
      process.exit(1)
    }
    console.log(`Wiping ${count} existing items (--force)…`)
    const { error } = await supabase.from('items').delete().not('id', 'is', null)
    if (error) throw error
  }

  const { data, error } = await supabase.from('items').insert(items).select('id')
  if (error) throw error
  console.log(`Inserted ${data!.length} items ✔`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
