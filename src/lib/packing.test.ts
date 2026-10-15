import { describe, expect, it } from 'vitest'
import type { OrderItem } from './types'
import { pickKey, pickList, pruneTicks } from './packing'

const line = (id: string, order_id: string, item_id: string | null, name_text: string | null, qty: number) =>
  ({ id, order_id, item_id, name_text, qty }) as OrderItem
const catalog = new Map([
  ['b', { name: 'Значок', fandom: 'tgcf', image_url: 'b.png' }],
  ['s', { name: 'Шейкер', fandom: 'msch', image_url: null }],
  ['k', { name: 'Брелок', fandom: 'msch', image_url: null }],
])

describe('pickList', () => {
  const rows = pickList(
    [
      line('1', 'o1', 'b', 'Значок', 2),
      line('2', 'o2', 'b', 'Значок', 1),
      line('3', 'o2', 's', 'Шейкер', 1),
      line('4', 'o3', null, 'Открытка ', 1),
      line('5', 'o3', null, 'открытка', 2),
      line('6', 'o3', 'k', 'Брелок', 1),
    ],
    catalog,
  )

  it('sums quantities per item and counts the orders that need it', () => {
    const badge = rows.find((r) => r.key === 'b')!
    expect(badge).toMatchObject({ name: 'Значок', qty: 3, orders: 2, image: 'b.png' })
  })

  it('merges custom lines by name, ignoring case and spaces', () => {
    expect(rows.find((r) => r.key === 'name:открытка')).toMatchObject({ qty: 3, orders: 1 })
  })

  it('orders by fandom, then name, with custom lines last', () => {
    expect(rows.map((r) => r.name)).toEqual(['Брелок', 'Шейкер', 'Значок', 'Открытка '])
  })
})

describe('pickKey', () => {
  it('uses the item id when linked', () => {
    expect(pickKey({ item_id: 'x', name_text: 'Y' })).toBe('x')
  })
})

describe('pruneTicks', () => {
  it('keeps only ticks still on the list', () => {
    expect(pruneTicks(['a', 'b', 'c'], ['c', 'a', 'z'])).toEqual(['a', 'c'])
  })
})
