// Seed individual character shakers, Good Child items, gacha items,
// and bundle definitions into Supabase.
//
// Run AFTER applying supabase/migrations/002_bundle_items.sql in the Supabase SQL editor.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/seed-bundles.ts [--dry-run]

import { createClient } from '@supabase/supabase-js'

const dryRun = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !key)) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const db = !dryRun ? createClient(url!, key!) : null

const NEW_ITEMS = [
  // Individual MSCH character shakers
  { sku: 'MSCH-SH-01', type: 'шейкер', fandom: '[MSCH]', name: 'шейкер юхён', sale_price: 500, stock_qty: 0 },
  { sku: 'MSCH-SH-02', type: 'шейкер', fandom: '[MSCH]', name: 'шейкер юджин', sale_price: 500, stock_qty: 0 },
  { sku: 'MSCH-SH-03', type: 'шейкер', fandom: '[MSCH]', name: 'шейкер хёнджэ', sale_price: 500, stock_qty: 0 },
  // Individual ORV character shakers
  { sku: 'ORV-SH-01', type: 'шейкер', fandom: '[ORV]', name: 'шейкер докча', sale_price: 500, stock_qty: 0 },
  { sku: 'ORV-SH-02', type: 'шейкер', fandom: '[ORV]', name: 'шейкер соён', sale_price: 500, stock_qty: 0 },
  { sku: 'ORV-SH-03', type: 'шейкер', fandom: '[ORV]', name: 'шейкер джунхёк', sale_price: 500, stock_qty: 0 },
  { sku: 'ORV-SH-04', type: 'шейкер', fandom: '[ORV]', name: 'шейкер плоттер', sale_price: 500, stock_qty: 0 },
  // Good Child / storypack items
  { sku: 'ORV-GC-01', type: 'шейкер', fandom: '[ORV]', name: 'storypack шейкер', sale_price: 600, stock_qty: 0 },
  { sku: 'ORV-GC-02', type: 'брелок', fandom: '[ORV]', name: 'конфета [good child candy]', sale_price: 600, stock_qty: 0 },
  { sku: 'ORV-GC-03', type: 'открытка А6', fandom: '[ORV]', name: 'шоколадка [good child]', sale_price: 650, stock_qty: 0 },
  { sku: 'ORV-GC-04', type: 'открытка А6', fandom: '[ORV]', name: 'шоколадка уриэль', sale_price: 650, stock_qty: 0 },
  { sku: 'MSCH-GC-01', type: 'брелок', fandom: '[MSCH]', name: 'пудинг братишки', sale_price: 400, stock_qty: 0 },
  // Gacha
  { sku: 'ORV-G-01', type: 'гача', fandom: '[ORV]', name: 'гача 1 крутка', sale_price: 150, stock_qty: 0 },
  { sku: 'ORV-G-02', type: 'гача', fandom: '[ORV]', name: 'гача 2 крутки', sale_price: 300, stock_qty: 0 },
  { sku: 'ORV-G-03', type: 'гача', fandom: '[ORV]', name: 'гача 4 крутки', sale_price: 600, stock_qty: 0 },
  { sku: 'ORV-G-04', type: 'гача', fandom: '[ORV]', name: 'гача выкуп', sale_price: 250, stock_qty: 0 },
  { sku: 'ORV-G-05', type: 'гача', fandom: '[ORV]', name: 'гача [все регрессии]', sale_price: 2000, stock_qty: 0 },
  // Bundles (cost = sum of components where known)
  { sku: 'MSCH-SET-01', type: 'набор', fandom: '[MSCH]', name: 'загробные с классы', cost_price: 180, sale_price: 800, stock_qty: 0 },
  { sku: 'MSCH-SET-02', type: 'набор', fandom: '[MSCH]', name: 'шейкер троица вместе', sale_price: 1400, stock_qty: 0 },
  { sku: 'MSCH-SET-03', type: 'набор', fandom: '[MSCH]', name: 'сет из двух брелков', cost_price: 290, sale_price: 900, stock_qty: 0 },
  { sku: 'ORV-SET-01', type: 'набор', fandom: '[ORV]', name: 'загробный юханким', cost_price: 180, sale_price: 800, stock_qty: 0 },
  { sku: 'ORV-SET-02', type: 'набор', fandom: '[ORV]', name: 'шейкеры юханким плоттер', sale_price: 1800, stock_qty: 0 },
]

// Bundle name → [component name, qty][]
// Component names must exactly match item names in the DB.
const BUNDLE_COMPOSITIONS: Record<string, [string, number][]> = {
  'загробные с классы': [
    ['гробик юхён', 1],
    ['гробик юджин', 1],
    ['гробик хёнджэ', 1],
  ],
  'шейкер троица вместе': [
    ['шейкер юхён', 1],
    ['шейкер юджин', 1],
    ['шейкер хёнджэ', 1],
  ],
  'сет из двух брелков': [
    ['юджин + юхён сборный', 1],
    ['юджин + хёнджэ сборный', 1],
  ],
  'загробный юханким': [
    ['гробик yjh', 1],
    ['гробик kdj', 1],
    ['гробик hsy', 1],
  ],
  'шейкеры юханким плоттер': [
    ['шейкер докча', 1],
    ['шейкер соён', 1],
    ['шейкер джунхёк', 1],
    ['шейкер плоттер', 1],
  ],
}

async function main() {
  if (dryRun) {
    console.log('--- DRY RUN ---')
    console.log(`\nNew items to insert (${NEW_ITEMS.length}):`)
    for (const item of NEW_ITEMS) console.log(`  [${item.sku}] ${item.name} — ${item.sale_price}р`)
    console.log('\nBundle compositions:')
    for (const [bundle, components] of Object.entries(BUNDLE_COMPOSITIONS)) {
      console.log(`  ${bundle}: ${components.map(([n, q]) => (q > 1 ? `${n} ×${q}` : n)).join(' + ')}`)
    }
    return
  }

  // Fetch existing items to check for duplicates
  const { data: existing, error: fetchErr } = await db!.from('items').select('id, name, sku')
  if (fetchErr) throw fetchErr
  const existingSkus = new Set(existing!.map((i) => i.sku).filter(Boolean))
  const existingNames = new Map(existing!.map((i) => [i.name, i.id]))

  const toInsert = NEW_ITEMS.filter((item) => {
    if (existingSkus.has(item.sku)) {
      console.log(`  Skip (already exists): ${item.sku} ${item.name}`)
      return false
    }
    return true
  })

  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await db!.from('items').insert(toInsert).select('id, name')
    if (insertErr) throw insertErr
    for (const i of inserted!) existingNames.set(i.name, i.id)
    console.log(`Inserted ${inserted!.length} new items`)
  } else {
    console.log('No new items to insert (all already exist)')
  }

  // Wipe existing bundle_items and re-insert
  const bundleIds = Object.keys(BUNDLE_COMPOSITIONS)
    .map((name) => existingNames.get(name))
    .filter(Boolean) as string[]

  if (bundleIds.length > 0) {
    const { error: delErr } = await db!.from('bundle_items').delete().in('bundle_id', bundleIds)
    if (delErr) throw delErr
  }

  const bundleRows: { bundle_id: string; component_id: string; qty: number }[] = []
  for (const [bundleName, components] of Object.entries(BUNDLE_COMPOSITIONS)) {
    const bundleId = existingNames.get(bundleName)
    if (!bundleId) { console.warn(`  WARN: bundle "${bundleName}" not found in DB`); continue }
    for (const [componentName, qty] of components) {
      const componentId = existingNames.get(componentName)
      if (!componentId) { console.warn(`  WARN: component "${componentName}" not found in DB`); continue }
      bundleRows.push({ bundle_id: bundleId, component_id: componentId, qty })
    }
  }

  if (bundleRows.length > 0) {
    const { error: bundleErr } = await db!.from('bundle_items').insert(bundleRows)
    if (bundleErr) throw bundleErr
    console.log(`Inserted ${bundleRows.length} bundle component links`)
  }

  console.log('Done ✔')
}

main().catch((err) => { console.error(err); process.exit(1) })
