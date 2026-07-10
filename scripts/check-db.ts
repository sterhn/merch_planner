// Health-check the Supabase database and optionally backfill missing SKUs.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/check-db.ts [--fix-skus]
//
// Read-only by default. Reports:
//   - row counts per table
//   - whether migration 004 is applied (description / product_photo_url columns)
//   - whether the item-images and product-photos storage buckets exist
//   - items with missing or duplicate SKUs (and what a backfill would assign)
//   - bundle compositions
//
// --fix-skus  actually writes the proposed SKUs for items that lack one.
//             New SKUs are FANDOM-NN, continuing after the highest existing
//             number for that fandom and never colliding with any current SKU.

import { createClient } from '@supabase/supabase-js'

const fixSkus = process.argv.includes('--fix-skus')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const db = createClient(url, key)

interface ItemRow {
  id: string
  sku: string | null
  name: string
  type: string | null
  fandom: string | null
}

function skuPrefix(fandom: string | null): string {
  return (fandom ?? '').replace(/[[\]]/g, '').toUpperCase().trim()
}

async function main() {
  let problems = 0

  // --- Row counts ---
  console.log('Row counts:')
  for (const table of ['items', 'orders', 'order_items', 'bundle_items', 'collects', 'collect_items', 'shelf_items', 'expenses']) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`  ${table}: ERROR — ${error.message}`)
      problems++
    } else {
      console.log(`  ${table}: ${count}`)
    }
  }

  // --- Migration 004 columns ---
  const { error: colError } = await db.from('items').select('id, description, product_photo_url').limit(1)
  if (colError) {
    console.log(`\n✗ Migration 004 NOT applied — ${colError.message}`)
    console.log('  Run supabase/migrations/004_product_photos.sql in the SQL editor.')
    problems++
  } else {
    console.log('\n✓ Migration 004 applied (description + product_photo_url columns exist)')
  }

  // --- Storage buckets ---
  const { data: buckets, error: bucketError } = await db.storage.listBuckets()
  if (bucketError) {
    console.log(`✗ Could not list storage buckets — ${bucketError.message}`)
    problems++
  } else {
    for (const name of ['item-images', 'product-photos']) {
      const bucket = buckets.find((b) => b.name === name)
      if (!bucket) {
        console.log(`✗ Storage bucket "${name}" is missing`)
        problems++
      } else {
        console.log(`✓ Storage bucket "${name}" exists${bucket.public ? ' (public)' : ' — WARNING: not public, image URLs will 400'}`)
        if (!bucket.public) problems++
      }
    }
  }

  // --- Items / SKUs ---
  const { data: items, error: itemsError } = await db
    .from('items')
    .select('id, sku, name, type, fandom')
    .order('fandom')
    .returns<ItemRow[]>()
  if (itemsError || !items) {
    console.log(`✗ Could not read items — ${itemsError?.message}`)
    process.exit(1)
  }

  const bySku = new Map<string, ItemRow[]>()
  for (const item of items) {
    if (!item.sku) continue
    const arr = bySku.get(item.sku) ?? []
    arr.push(item)
    bySku.set(item.sku, arr)
  }
  const duplicates = Array.from(bySku.entries()).filter(([, rows]) => rows.length > 1)
  if (duplicates.length > 0) {
    console.log(`\n✗ Duplicate SKUs (${duplicates.length}):`)
    for (const [sku, rows] of duplicates) {
      console.log(`  ${sku}: ${rows.map((r) => r.name).join(' / ')}`)
    }
    problems += duplicates.length
  } else {
    console.log('\n✓ No duplicate SKUs')
  }

  const missing = items.filter((i) => !i.sku?.trim())
  if (missing.length === 0) {
    console.log('✓ Every item has a SKU')
  } else {
    console.log(`\nItems without a SKU (${missing.length}):`)

    // Continue numbering after the highest existing FANDOM-NN (bare numeric
    // suffix); FANDOM-CAT-NN style SKUs from the imports are left untouched
    // and can't collide with the generated ones.
    const taken = new Set(items.map((i) => i.sku).filter(Boolean) as string[])
    const nextByPrefix = new Map<string, number>()
    for (const sku of taken) {
      const match = sku.match(/^(.+)-(\d+)$/)
      if (!match) continue
      const n = Number(match[2])
      if (n > (nextByPrefix.get(match[1]) ?? 0)) nextByPrefix.set(match[1], n)
    }

    const proposals: { id: string; name: string; sku: string }[] = []
    for (const item of missing) {
      const prefix = skuPrefix(item.fandom)
      if (!prefix) {
        console.log(`  SKIP (no fandom): ${item.name}`)
        continue
      }
      let n = (nextByPrefix.get(prefix) ?? 0) + 1
      while (taken.has(`${prefix}-${String(n).padStart(2, '0')}`)) n++
      const sku = `${prefix}-${String(n).padStart(2, '0')}`
      nextByPrefix.set(prefix, n)
      taken.add(sku)
      proposals.push({ id: item.id, name: item.name, sku })
      console.log(`  ${fixSkus ? 'SET' : 'would set'} ${sku}: ${item.name}`)
    }

    if (fixSkus) {
      for (const p of proposals) {
        const { error } = await db.from('items').update({ sku: p.sku }).eq('id', p.id)
        if (error) {
          console.log(`  ✗ Failed to set ${p.sku} on "${p.name}" — ${error.message}`)
          problems++
        }
      }
      console.log(`Updated ${proposals.length} SKUs ✔`)
    } else if (proposals.length > 0) {
      console.log('Re-run with --fix-skus to write these.')
    }
  }

  // --- Bundles ---
  const { data: bundles, error: bundleError } = await db
    .from('bundle_items')
    .select('bundle_id, component_id, qty')
  if (bundleError) {
    console.log(`✗ Could not read bundle_items — ${bundleError.message}`)
    problems++
  } else if (bundles && bundles.length > 0) {
    const byId = new Map(items.map((i) => [i.id, i.name]))
    const grouped = new Map<string, string[]>()
    for (const b of bundles) {
      const arr = grouped.get(b.bundle_id) ?? []
      const name = byId.get(b.component_id) ?? '??'
      arr.push(b.qty > 1 ? `${name} ×${b.qty}` : name)
      grouped.set(b.bundle_id, arr)
    }
    console.log(`\nBundles (${grouped.size}):`)
    for (const [bundleId, components] of grouped) {
      console.log(`  ${byId.get(bundleId) ?? bundleId}: ${components.join(' + ')}`)
    }
  } else {
    console.log('\nNo bundles defined yet.')
  }

  console.log(problems === 0 ? '\nAll good ✔' : `\n${problems} problem(s) found.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
