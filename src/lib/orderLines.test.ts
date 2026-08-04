import { describe, expect, it } from 'vitest'
import { fandomOf, groupLinesByFandom, linesTotal, NO_FANDOM_LABEL, sortLinesByPrice } from './orderLines'
import type { OrderItem } from './types'

function line(
  id: string,
  item_id: string | null,
  position: number,
  unit_price: number | null = null,
  qty = 1,
): OrderItem {
  return {
    id,
    order_id: 'o1',
    item_id,
    name_text: null,
    category: null,
    qty,
    unit_price,
    position,
    created_at: '2026-07-01T00:00:00Z',
  }
}

const catalog = new Map([
  ['orv1', { fandom: '[ORV]' }],
  ['orv2', { fandom: '[ORV]' }],
  ['msch1', { fandom: '[MSCH]' }],
  ['blank', { fandom: null }],
  ['spaces', { fandom: '   ' }],
  ['ru', { fandom: 'Мосты' }],
])

describe('fandomOf', () => {
  it('reads the fandom of the linked catalog item', () => {
    expect(fandomOf(line('l1', 'orv1', 0), catalog)).toBe('[ORV]')
  })

  it('is null for custom lines and for blank or whitespace fandoms', () => {
    expect(fandomOf(line('l1', null, 0), catalog)).toBeNull()
    expect(fandomOf(line('l2', 'blank', 1), catalog)).toBeNull()
    expect(fandomOf(line('l3', 'spaces', 2), catalog)).toBeNull()
  })

  it('is null when the line points at an item missing from the catalog', () => {
    expect(fandomOf(line('l1', 'deleted', 0), catalog)).toBeNull()
  })
})

describe('sortLinesByPrice', () => {
  it('puts the priciest line first', () => {
    const sorted = sortLinesByPrice([
      line('cheap', null, 0, 250),
      line('dear', null, 1, 900),
      line('mid', null, 2, 650),
    ])
    expect(sorted.map((l) => l.id)).toEqual(['dear', 'mid', 'cheap'])
  })

  it('sinks lines with no price to the bottom', () => {
    const sorted = sortLinesByPrice([
      line('free', null, 0, null),
      line('zero', null, 1, 0),
      line('paid', null, 2, 100),
    ])
    expect(sorted[0].id).toBe('paid')
    expect(sorted.slice(1).map((l) => l.id)).toEqual(['free', 'zero'])
  })

  it('sorts on the unit price, not the line total', () => {
    const sorted = sortLinesByPrice([line('bulk', null, 0, 400, 3), line('single', null, 1, 500)])
    expect(sorted.map((l) => l.id)).toEqual(['single', 'bulk'])
  })

  it('breaks equal unit prices with the bigger line, then the stored position', () => {
    const sorted = sortLinesByPrice([
      line('later', null, 5, 300),
      line('earlier', null, 1, 300),
      line('two-up', null, 9, 300, 2),
    ])
    expect(sorted.map((l) => l.id)).toEqual(['two-up', 'earlier', 'later'])
  })

  it('leaves the input array untouched', () => {
    const input = [line('a', null, 0, 100), line('b', null, 1, 900)]
    sortLinesByPrice(input)
    expect(input.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('groupLinesByFandom', () => {
  it('groups by fandom and sorts the groups by name', () => {
    const groups = groupLinesByFandom(
      [line('a', 'orv1', 0), line('b', 'msch1', 1), line('c', 'orv2', 2)],
      catalog,
    )
    expect(groups.map((g) => g.fandom)).toEqual(['[MSCH]', '[ORV]'])
    expect(groups[1].lines.map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('sorts each group priciest first', () => {
    const groups = groupLinesByFandom(
      [line('cheap', 'orv1', 0, 250), line('dear', 'orv2', 1, 900)],
      catalog,
    )
    expect(groups[0].lines.map((l) => l.id)).toEqual(['dear', 'cheap'])
  })

  it('collects lines without a fandom into a trailing unnamed group', () => {
    const groups = groupLinesByFandom(
      [line('custom', null, 0), line('a', 'orv1', 1), line('nofandom', 'blank', 2)],
      catalog,
    )
    expect(groups.map((g) => g.fandom)).toEqual(['[ORV]', null])
    expect(groups[1].lines.map((l) => l.id)).toEqual(['custom', 'nofandom'])
  })

  it('sorts Cyrillic fandom names next to bracketed Latin ones', () => {
    const groups = groupLinesByFandom([line('a', 'ru', 0), line('b', 'orv1', 1)], catalog)
    expect(groups.map((g) => g.fandom)).toEqual(['[ORV]', 'Мосты'])
  })

  it('returns nothing for an empty order', () => {
    expect(groupLinesByFandom([], catalog)).toEqual([])
  })

  it('exposes a label for the fandom-less group', () => {
    expect(NO_FANDOM_LABEL).toBe('Other')
  })
})

describe('linesTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(linesTotal([line('a', null, 0, 100, 2), line('b', null, 1, 50, 3)])).toBe(350)
  })
  it('counts unpriced lines as zero rather than NaN', () => {
    expect(linesTotal([line('a', null, 0, null, 4), line('b', null, 1, 25, 2)])).toBe(50)
  })
  it('is zero for no lines', () => {
    expect(linesTotal([])).toBe(0)
    expect(linesTotal(null)).toBe(0)
    expect(linesTotal(undefined)).toBe(0)
  })
})
