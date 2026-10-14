// App preferences stored in the `app_settings` table (migration 010), so they
// follow you between phone and laptop. Kept free of the Supabase client so the
// parsing can be unit-tested (see .claude/skills/verify).

export interface Settings {
  /** Catalog items at or below this stock show as "running low". */
  lowStockThreshold: number
  /** ISO timestamp of the last "Download backup", or null if never. */
  lastBackupAt: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  lowStockThreshold: 2,
  lastBackupAt: null,
}

/** Column keys in app_settings for each setting. */
export const SETTING_KEYS = {
  lowStockThreshold: 'low_stock_threshold',
  lastBackupAt: 'last_backup_at',
} as const satisfies Record<keyof Settings, string>

/** Remind about a backup once the last one is older than this. */
export const BACKUP_REMINDER_DAYS = 30

export function readSettings(rows: readonly { key: string; value: unknown }[] | null | undefined): Settings {
  const byKey = new Map((rows ?? []).map((r) => [r.key, r.value]))
  const threshold = byKey.get(SETTING_KEYS.lowStockThreshold)
  const lastBackup = byKey.get(SETTING_KEYS.lastBackupAt)
  return {
    lowStockThreshold:
      typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0
        ? Math.round(threshold)
        : DEFAULT_SETTINGS.lowStockThreshold,
    lastBackupAt: typeof lastBackup === 'string' ? lastBackup : null,
  }
}

/** True when there has never been a backup, or the last one is over BACKUP_REMINDER_DAYS old. */
export function backupDue(lastBackupAt: string | null, now: Date): boolean {
  if (!lastBackupAt) return true
  const at = Date.parse(lastBackupAt)
  if (Number.isNaN(at)) return true
  return now.getTime() - at > BACKUP_REMINDER_DAYS * 86_400_000
}
