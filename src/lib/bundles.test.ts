import { describe, expect, it } from 'vitest'
import type { Item } from './types'
import {
  buildableCount,
  buildableCounts,
  effectiveStock,
  groupBundles,
  summarizeParts,
} from './bundles'

function item(id: string, stock: number | null): Item {
  return { id, name: id, stock_qty: stock } as Item
}

const catalog = new Map<string, Item>([
  ['sticker', item('sticker', 10)],
  ['charm', item('charm', 3)],
  ['card', item('card', 0)],
  ['unstocked', item('unstocked', null)],
])

const bundles = groupBundles([
  { bundle_id: 'set', component_id: 'sticker', qty: 2 },
  { bundle_id: 'set', component_id: 'charm', qty: 1 },
  { bundle_id: 'soldout', component_id: 'card', qty: 1 },
  { bundle_id: 'nostock', component_id: 'unstocked', qty: 1 },
])

describe('groupBundles', () => {
  it('collects components under their bundle', () => {
    expect(bundles.get('set')).toHaveLength(2)
    expect(bundles.get('soldout')).toHaveLength(1)
  })
  it('tolerates missing input', () => {
    expect(groupBundles(null).size).toBe(0)
    expect(groupBundles(undefined).size).toBe(0)
  })
})

describe('buildableCount', () => {
  it('is limited by the scarcest component', () => {
    // sticker allows 5 sets (10 / 2), charm only 3.
    expect(buildableCount('set', bundles, catalog)).toBe(3)
  })
  it('returns null for items that are not bundles', () => {
    expect(buildableCount('sticker', bundles, catalog)).toBeNull()
  })
  it('is zero, not negative, when a component is out of stock', () => {
    expect(buildableCount('soldout', bundles, catalog)).toBe(0)
  })
  it('treats null stock as none', () => {
    expect(buildableCount('nostock', bundles, catalog)).toBe(0)
  })
  it('does not divide by zero when a component qty is 0', () => {
    const odd = groupBundles([{ bundle_id: 'b', component_id: 'sticker', qty: 0 }])
    expect(buildableCount('b', odd, catalog)).toBe(10)
  })
  it('ignores components missing from the catalog', () => {
    const orphan = groupBundles([{ bundle_id: 'b', component_id: 'gone', qty: 1 }])
    expect(buildableCount('b', orphan, catalog)).toBe(0)
  })
})

describe('buildableCounts', () => {
  it('matches buildableCount for every bundle', () => {
    const counts = buildableCounts(bundles, catalog)
    expect(counts.get('set')).toBe(3)
    expect(counts.get('soldout')).toBe(0)
    expect(counts.has('sticker')).toBe(false)
  })
})

describe('effectiveStock', () => {
  it('uses the buildable count for bundles', () => {
    expect(effectiveStock(item('set', 99), bundles, catalog)).toBe(3)
  })
  it('falls back to plain stock for ordinary items', () => {
    expect(effectiveStock(item('sticker', 10), bundles, catalog)).toBe(10)
    expect(effectiveStock(item('sticker', null), bundles, catalog)).toBe(0)
  })
})

describe('summarizeParts', () => {
  it('shows a multiplier only above one', () => {
    expect(summarizeParts([{ name: 'Стикер', qty: 2 }, { name: 'Значок', qty: 1 }])).toBe('Стикер ×2 + Значок')
  })
  it('is empty for no parts', () => {
    expect(summarizeParts([])).toBe('')
  })
})
