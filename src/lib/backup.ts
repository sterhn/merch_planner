// Full-data backup: every table as JSON in one file, and the plan for putting
// it back (scripts/restore-backup.ts). Kept free of the Supabase client so it
// can be unit-tested.

/**
 * Tables in restore order — parents before the rows that reference them.
 * `items` is listed again at the end of the restore plan (see restorePlan).
 */
export const BACKUP_TABLES = [
  'items',
  'bundle_items',
  'orders',
  'order_items',
  'collects',
  'collect_items',
  'expenses',
  'shelf_items',
  'app_settings',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/** Tables a database from before migration 010 doesn't have yet. */
export const OPTIONAL_TABLES: ReadonlySet<BackupTable> = new Set(['app_settings'])

/** Computed by Postgres — inserting a value into them is an error. */
const GENERATED_COLUMNS: Partial<Record<BackupTable, readonly string[]>> = {
  items: ['profit'],
  collects: ['total_cost', 'cost_per_unit'],
  shelf_items: ['qty_remaining', 'income'],
}

export const BACKUP_FORMAT = 'merch-planner-backup'

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: 1
  created_at: string
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>
}

export function makeBackup(tables: Backup['tables'], now: Date): Backup {
  return { format: BACKUP_FORMAT, version: 1, created_at: now.toISOString(), tables }
}

/** merch-planner-backup-2026-10-14.json, in the local date. */
export function backupFileName(now: Date): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `${BACKUP_FORMAT}-${d}.json`
}

export function parseBackup(json: string): Backup {
  const data = JSON.parse(json) as Partial<Backup>
  if (data.format !== BACKUP_FORMAT || data.version !== 1 || typeof data.tables !== 'object' || !data.tables) {
    throw new Error('Not a Merch Planner backup file.')
  }
  return data as Backup
}

function stripGenerated(table: BackupTable, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const drop = GENERATED_COLUMNS[table]
  if (!drop) return rows
  return rows.map((row) => {
    const copy = { ...row }
    for (const col of drop) delete copy[col]
    return copy
  })
}

/**
 * The upserts that restore a backup, in order. Order lines inserted into a
 * sent order move stock (migration 010's triggers), so `items` is written once
 * more at the end — that puts every stock count back to the backed-up value.
 */
export function restorePlan(backup: Backup): { table: BackupTable; rows: Record<string, unknown>[] }[] {
  const steps = BACKUP_TABLES.filter((t) => (backup.tables[t]?.length ?? 0) > 0).map((table) => ({
    table,
    rows: stripGenerated(table, backup.tables[table]!),
  }))
  const items = steps.find((s) => s.table === 'items')
  if (items) steps.push({ table: 'items', rows: items.rows })
  return steps
}
