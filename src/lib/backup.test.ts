import { describe, expect, it } from 'vitest'
import { backupFileName, makeBackup, parseBackup, restorePlan } from './backup'

describe('backup file', () => {
  const now = new Date(2026, 9, 14, 23, 30)

  it('is named by the local date', () => {
    expect(backupFileName(now)).toBe('merch-planner-backup-2026-10-14.json')
  })

  it('round-trips through JSON', () => {
    const backup = makeBackup({ orders: [{ id: 'o1', paid: true }] }, now)
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('Not a Merch Planner backup file.')
  })
})

describe('restorePlan', () => {
  const backup = makeBackup(
    {
      items: [{ id: 'i1', name: 'A', stock_qty: 4, profit: 50 }],
      orders: [{ id: 'o1', sent: true }],
      order_items: [{ id: 'l1', order_id: 'o1', item_id: 'i1', qty: 2 }],
      collects: [{ id: 'c1', total_cost: 100, cost_per_unit: 10, print_cost: 100 }],
      expenses: [],
    },
    new Date(),
  )
  const plan = restorePlan(backup)

  it('writes parents before children and skips empty tables', () => {
    expect(plan.map((s) => s.table)).toEqual(['items', 'orders', 'order_items', 'collects', 'items'])
  })

  it('drops generated columns Postgres would reject', () => {
    expect(plan[0].rows[0]).toEqual({ id: 'i1', name: 'A', stock_qty: 4 })
    expect(plan.find((s) => s.table === 'collects')!.rows[0]).toEqual({ id: 'c1', print_cost: 100 })
  })

  it('rewrites items last so stock ends at the backed-up value', () => {
    // Inserting a line into a sent order moves stock; the final items pass resets it.
    expect(plan[plan.length - 1]).toEqual({ table: 'items', rows: [{ id: 'i1', name: 'A', stock_qty: 4 }] })
  })
})
