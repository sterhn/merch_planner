import { describe, expect, it } from 'vitest'
import type { Item } from './types'
import { isCatalogSort, sortCatalog } from './catalogSort'

const item = (id: string, extra: Partial<Item>): Item =>
  ({ id, name: id, type: null, sale_price: null, stock_qty: 0, created_at: '2026-01-01T00:00:00Z', ...extra }) as Item

const items = [
  item('Яблоко', { type: 'значок', sale_price: 200, stock_qty: 9, created_at: '2026-03-01T00:00:00Z' }),
  item('Арбуз', { type: 'брелок', sale_price: 450, stock_qty: 1, created_at: '2026-01-01T00:00:00Z' }),
  item('Вишня', { type: null, sale_price: null, stock_qty: 4, created_at: '2026-05-01T00:00:00Z' }),
  item('Банан', { type: 'брелок', sale_price: 200, stock_qty: 1, created_at: '2026-02-01T00:00:00Z' }),
]
const names = (rows: Item[]) => rows.map((r) => r.name)
const stock = (i: Item) => i.stock_qty ?? 0

describe('sortCatalog', () => {
  it('sorts by name in Russian collation', () => {
    expect(names(sortCatalog(items, 'name', stock))).toEqual(['Арбуз', 'Банан', 'Вишня', 'Яблоко'])
  })

  it('puts low stock first, ties by name', () => {
    expect(names(sortCatalog(items, 'stock', stock))).toEqual(['Арбуз', 'Банан', 'Вишня', 'Яблоко'])
  })

  it('uses the shown stock (e.g. bundles) rather than stock_qty', () => {
    const bundleStock = (i: Item) => (i.name === 'Яблоко' ? 0 : stock(i))
    expect(names(sortCatalog(items, 'stock', bundleStock))[0]).toBe('Яблоко')
  })

  it('puts the priciest first and unpriced last', () => {
    expect(names(sortCatalog(items, 'price', stock))).toEqual(['Арбуз', 'Банан', 'Яблоко', 'Вишня'])
  })

  it('puts the newest first', () => {
    expect(names(sortCatalog(items, 'newest', stock))).toEqual(['Вишня', 'Яблоко', 'Банан', 'Арбуз'])
  })

  it('groups by type with untyped items last', () => {
    expect(names(sortCatalog(items, 'type', stock))).toEqual(['Арбуз', 'Банан', 'Яблоко', 'Вишня'])
  })

  it('does not mutate its input', () => {
    const copy = [...items]
    sortCatalog(items, 'name', stock)
    expect(items).toEqual(copy)
  })
})

describe('isCatalogSort', () => {
  it('accepts known keys only', () => {
    expect(isCatalogSort('price')).toBe(true)
    expect(isCatalogSort('colour')).toBe(false)
  })
})
