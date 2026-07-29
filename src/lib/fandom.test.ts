import { describe, expect, it } from 'vitest'
import { fandomOf, groupLinesByFandom, NO_FANDOM_LABEL } from './fandom'
import type { OrderItem } from './types'

function line(id: string, item_id: string | null, position: number): OrderItem {
  return {
    id,
    order_id: 'o1',
    item_id,
    name_text: null,
    category: null,
    qty: 1,
    unit_price: null,
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

describe('groupLinesByFandom', () => {
  it('groups by fandom and sorts the groups by name', () => {
    const groups = groupLinesByFandom(
      [line('a', 'orv1', 0), line('b', 'msch1', 1), line('c', 'orv2', 2)],
      catalog,
    )
    expect(groups.map((g) => g.fandom)).toEqual(['[MSCH]', '[ORV]'])
    expect(groups[1].lines.map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('keeps the given line order inside each group', () => {
    const groups = groupLinesByFandom([line('c', 'orv2', 0), line('a', 'orv1', 1)], catalog)
    expect(groups[0].lines.map((l) => l.id)).toEqual(['c', 'a'])
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
