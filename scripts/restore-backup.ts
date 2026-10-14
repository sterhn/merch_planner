// Restore a backup made with Settings → "Download backup".
//
// Usage:
//   npx tsx scripts/restore-backup.ts merch-planner-backup-2026-10-14.json --dry-run
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx scripts/restore-backup.ts merch-planner-backup-2026-10-14.json
//
// --dry-run  read the file and print what would be written, write nothing
//
// Every row is upserted by id: rows in the backup are added back or
// overwritten with their backed-up values. Rows created after the backup are
// left alone (nothing is deleted). Run every migration first, so the database
// has all the columns the backup carries.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseBackup, restorePlan } from '../src/lib/backup'

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')

if (!filePath) {
  console.error('Usage: npx tsx scripts/restore-backup.ts <backup.json> [--dry-run]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !key)) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or use --dry-run).')
  process.exit(1)
}

const backup = parseBackup(readFileSync(filePath, 'utf8'))
const plan = restorePlan(backup)
console.log(`Backup from ${backup.created_at}`)
for (const step of plan) console.log(`  ${step.table.padEnd(14)} ${step.rows.length} rows`)

if (dryRun) {
  console.log('Dry run — nothing written.')
  process.exit(0)
}

const db = createClient(url!, key!)
const CHUNK = 500

for (const { table, rows } of plan) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // app_settings is keyed by `key`; every other table by `id`.
    const { error } = await db
      .from(table)
      .upsert(rows.slice(i, i + CHUNK), { onConflict: table === 'app_settings' ? 'key' : 'id' })
    if (error) {
      console.error(`Failed on ${table}: ${error.message}`)
      process.exit(1)
    }
  }
  console.log(`✓ ${table}`)
}
console.log('Restore complete.')
