import { describe, expect, it } from 'vitest'
import { sortRows } from './useTable'

/**
 * useList sorts client-side now, so its ordering has to stay indistinguishable
 * from the `.order()` it replaced. The expectations below were taken from a
 * real Postgres 16 instance running this project's migrations:
 *
 *   ORDER BY v ASC   -> a, b, c, NULL, NULL
 *   ORDER BY v DESC  -> NULL, NULL, c, b, a
 */
const show = (rows: { v: unknown }[]) => rows.map((r) => r.v ?? 'NULL').join(',')

describe('sortRows null placement matches Postgres', () => {
  const rows = [{ v: 'b' }, { v: null }, { v: 'a' }, { v: null }, { v: 'c' }]

  it('puts nulls last when ascending', () => {
    expect(show(sortRows(rows, 'v', true))).toBe('a,b,c,NULL,NULL')
  })

  it('puts nulls first when descending', () => {
    // The collects list sorts on a nullable deadline descending, so getting
    // this backwards would silently move undated runs to the bottom.
    expect(show(sortRows(rows, 'v', false))).toBe('NULL,NULL,c,b,a')
  })

  it('handles all-null and empty inputs', () => {
    expect(show(sortRows([{ v: null }, { v: null }], 'v', true))).toBe('NULL,NULL')
    expect(sortRows([], 'v', true)).toEqual([])
  })
})

describe('sortRows value ordering', () => {
  it('compares numbers numerically, not lexically', () => {
    const rows = [{ v: 10 }, { v: 9 }, { v: 100 }]
    expect(show(sortRows(rows, 'v', true))).toBe('9,10,100')
  })

  it('orders Cyrillic by collation rather than code point', () => {
    const rows = [{ v: 'Ящик' }, { v: 'Альбом' }, { v: 'Значок' }]
    expect(show(sortRows(rows, 'v', true))).toBe('Альбом,Значок,Ящик')
  })

  it('sorts booleans false-then-true ascending, like Postgres', () => {
    const rows = [{ v: true }, { v: false }, { v: true }]
    expect(show(sortRows(rows, 'v', true))).toBe('false,true,true')
  })

  it('does not mutate its input', () => {
    const rows = [{ v: 'b' }, { v: 'a' }]
    sortRows(rows, 'v', true)
    expect(show(rows)).toBe('b,a')
  })
})
