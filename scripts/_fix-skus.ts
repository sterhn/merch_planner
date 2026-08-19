import { createClient } from '@supabase/supabase-js'

const dryRun = !process.argv.includes('--apply')
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TYPE_ABBR: Record<string, string> = {
  'брелок':       'K',
  'значок':       'B',
  'карточка':     'C',
  'открытка А6':  'PC',
  'открытка А5':  'PC2',
  'шейкер':       'SH',
  'стикеры':      'SK',
  'стенд':        'ST',
  'гача':         'G',
  'набор':        'SET',
  'лента':        'RB',
  'шоколадка':    'CH',
}

const FANDOM_PREFIX: Record<string, string> = {
  '[GSGW]': 'GSGW',
  '[MSCH]': 'MSCH',
  '[ORV]':  'ORV',
  '[OC]':   'OC',
}

interface Item {
  id: string
  sku: string | null
  name: string
  type: string | null
  fandom: string | null
}

function parseSku(sku: string): { prefix: string; typeCode: string | null; num: number } | null {
  // Match FANDOM-TYPE-NN or FANDOM-NN
  const compound = sku.match(/^([A-Z]+)-([A-Z][A-Z0-9]*)-(\d+)$/i)
  if (compound) {
    return { prefix: compound[1].toUpperCase(), typeCode: compound[2].toUpperCase(), num: parseInt(compound[3]) }
  }
  const simple = sku.match(/^([A-Z]+)-(\d+)$/i)
  if (simple) {
    return { prefix: simple[1].toUpperCase(), typeCode: null, num: parseInt(simple[2]) }
  }
  return null
}

async function main() {
  const { data: items, error } = await db
    .from('items')
    .select('id, sku, name, type, fandom')
    .order('fandom')
    .order('type')
    .order('sku')
    .returns<Item[]>()

  if (error || !items) { console.error('Failed:', error?.message); process.exit(1) }

  // Phase 1: Determine ideal SKU for every item
  // For items already in FANDOM-TYPE-NN format (with correct fandom prefix and correct type code),
  // keep their number. For everything else, assign new numbers.

  const changes: { id: string; name: string; oldSku: string; newSku: string }[] = []

  // Group by target (fandom_prefix, type_code) to track numbering
  const maxNum = new Map<string, number>() // "GSGW-K" → highest NN

  // First pass: register existing valid compound SKUs to know what numbers are taken
  for (const item of items) {
    if (!item.sku || !item.fandom || !item.type) continue
    const targetPrefix = FANDOM_PREFIX[item.fandom]
    const targetType = TYPE_ABBR[item.type]
    if (!targetPrefix || !targetType) continue

    const parsed = parseSku(item.sku)
    if (!parsed) continue

    // Normalize GS → GSGW for matching
    const normalizedPrefix = parsed.prefix === 'GS' ? 'GSGW' : parsed.prefix

    // If this SKU already has the right fandom prefix and the right type code, keep its number
    if (normalizedPrefix === targetPrefix && parsed.typeCode === targetType) {
      const key = `${targetPrefix}-${targetType}`
      maxNum.set(key, Math.max(maxNum.get(key) ?? 0, parsed.num))
    }
  }

  // Second pass: assign new SKUs
  for (const item of items) {
    if (!item.fandom || !item.type) {
      console.log(`SKIP (no fandom/type): "${item.name}" [${item.sku}]`)
      continue
    }
    const targetPrefix = FANDOM_PREFIX[item.fandom]
    const targetType = TYPE_ABBR[item.type]
    if (!targetPrefix) {
      console.log(`SKIP (unknown fandom "${item.fandom}"): "${item.name}" [${item.sku}]`)
      continue
    }
    if (!targetType) {
      console.log(`SKIP (unknown type "${item.type}"): "${item.name}" [${item.sku}]`)
      continue
    }

    const key = `${targetPrefix}-${targetType}`
    const parsed = item.sku ? parseSku(item.sku) : null
    const normalizedPrefix = parsed ? (parsed.prefix === 'GS' ? 'GSGW' : parsed.prefix) : null

    // Check if the SKU is already correct (right prefix, right type code)
    if (parsed && normalizedPrefix === targetPrefix && parsed.typeCode === targetType) {
      // Already has the right format, but might need GS→GSGW rename
      const idealSku = `${targetPrefix}-${targetType}-${String(parsed.num).padStart(2, '0')}`
      if (idealSku !== item.sku) {
        changes.push({ id: item.id, name: item.name, oldSku: item.sku!, newSku: idealSku })
      }
      continue
    }

    // Needs a new SKU: assign next available number
    const nextNum = (maxNum.get(key) ?? 0) + 1
    maxNum.set(key, nextNum)
    const newSku = `${targetPrefix}-${targetType}-${String(nextNum).padStart(2, '0')}`
    changes.push({ id: item.id, name: item.name, oldSku: item.sku ?? '(none)', newSku })
  }

  // Check for collisions in the final set
  const allFinalSkus = new Map<string, string>()
  // First add unchanged items
  for (const item of items) {
    const change = changes.find(c => c.id === item.id)
    const finalSku = change ? change.newSku : item.sku
    if (!finalSku) continue
    if (allFinalSkus.has(finalSku)) {
      console.error(`COLLISION: "${finalSku}" assigned to both "${allFinalSkus.get(finalSku)}" and "${item.name}"`)
    }
    allFinalSkus.set(finalSku, item.name)
  }

  // Print changes
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${changes.length} SKUs to change (${dryRun ? 'DRY RUN' : 'APPLYING'})`)
  console.log(`${'═'.repeat(60)}\n`)

  // Group by category
  const gsChanges = changes.filter(c => c.oldSku.startsWith('GS-'))
  const dupeChanges = changes.filter(c => {
    const dupeSkus = ['MSCH-39', 'MSCH-40', 'ORV-47', 'ORV-48', 'ORV-49', 'ORV-50']
    return dupeSkus.includes(c.oldSku)
  })
  const bareChanges = changes.filter(c => !c.oldSku.startsWith('GS-') && !['MSCH-39', 'MSCH-40', 'ORV-47', 'ORV-48', 'ORV-49', 'ORV-50'].includes(c.oldSku))

  if (gsChanges.length > 0) {
    console.log('  GS → GSGW renames:')
    for (const c of gsChanges) {
      console.log(`    ${c.oldSku.padEnd(14)} → ${c.newSku.padEnd(14)} ${c.name}`)
    }
  }

  if (dupeChanges.length > 0) {
    console.log('\n  Duplicate SKU fixes:')
    for (const c of dupeChanges) {
      console.log(`    ${c.oldSku.padEnd(14)} → ${c.newSku.padEnd(14)} ${c.name}`)
    }
  }

  if (bareChanges.length > 0) {
    console.log('\n  Adding type keyword:')
    for (const c of bareChanges) {
      console.log(`    ${c.oldSku.padEnd(14)} → ${c.newSku.padEnd(14)} ${c.name}`)
    }
  }

  if (!dryRun) {
    console.log('\nApplying...')
    let ok = 0, fail = 0
    for (const c of changes) {
      const { error } = await db.from('items').update({ sku: c.newSku }).eq('id', c.id)
      if (error) {
        console.error(`  FAIL ${c.oldSku} → ${c.newSku}: ${error.message}`)
        fail++
      } else {
        ok++
      }
    }
    console.log(`\nDone: ${ok} updated, ${fail} failed.`)
  } else {
    console.log(`\nRe-run with --apply to write these changes.`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
