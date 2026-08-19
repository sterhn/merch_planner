import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: items } = await db
    .from('items')
    .select('id, sku, name, type, fandom')
    .order('fandom')
    .order('type')
    .order('sku')

  if (!items) { console.error('Failed to fetch'); process.exit(1) }

  // Show all unique types
  const types = new Map<string, number>()
  for (const i of items) {
    const t = i.type ?? '(null)'
    types.set(t, (types.get(t) ?? 0) + 1)
  }
  console.log('=== ITEM TYPES ===')
  for (const [t, count] of [...types].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${count}`)
  }

  // Show all items grouped by fandom + type
  console.log('\n=== ALL ITEMS ===')
  let lastGroup = ''
  for (const i of items) {
    const group = `${i.fandom} / ${i.type}`
    if (group !== lastGroup) {
      console.log(`\n--- ${group} ---`)
      lastGroup = group
    }
    console.log(`  ${(i.sku ?? '???').padEnd(14)} ${i.name}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
