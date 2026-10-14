import { describe, expect, it } from 'vitest'
import { backupDue, DEFAULT_SETTINGS, readSettings } from './settings'

describe('readSettings', () => {
  it('falls back to defaults when nothing is stored (or the table is missing)', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('reads stored values by key', () => {
    const s = readSettings([
      { key: 'low_stock_threshold', value: 5 },
      { key: 'last_backup_at', value: '2026-10-01T10:00:00Z' },
    ])
    expect(s).toEqual({ lowStockThreshold: 5, lastBackupAt: '2026-10-01T10:00:00Z' })
  })

  it('ignores values of the wrong shape', () => {
    const s = readSettings([
      { key: 'low_stock_threshold', value: '7' },
      { key: 'last_backup_at', value: 42 },
    ])
    expect(s).toEqual(DEFAULT_SETTINGS)
    expect(readSettings([{ key: 'low_stock_threshold', value: -1 }]).lowStockThreshold).toBe(2)
  })
})

describe('backupDue', () => {
  const now = new Date('2026-10-14T12:00:00Z')

  it('is due when there has never been a backup', () => {
    expect(backupDue(null, now)).toBe(true)
  })

  it('is due once the last backup is over 30 days old', () => {
    expect(backupDue('2026-10-01T12:00:00Z', now)).toBe(false)
    expect(backupDue('2026-09-10T12:00:00Z', now)).toBe(true)
  })
})
