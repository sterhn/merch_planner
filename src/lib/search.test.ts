import { describe, expect, it } from 'vitest'
import type { Collect, Item, OrderWithPhotos } from './types'
import { searchAll } from './search'

const order = (id: string, telegram: string | null, itemNames: string[]): OrderWithPhotos =>
  ({
    id,
    telegram,
    customer_email: null,
    order_items: itemNames.map((name) => ({ name_text: null, item: { name, image_url: null } })),
  }) as unknown as OrderWithPhotos

const item = (id: string, name: string, extra: Partial<Item> = {}) =>
  ({ id, name, sku: null, fandom: null, type: null, ...extra }) as Item

describe('searchAll', () => {
  const orders = [
    order('o1', '@reader', ['Хуа Чэн брелок']),
    order('o2', '@huacheng_fan', ['Се Лянь значок']),
    order('o3', '@other', ['Венти стикер']),
  ]
  const items = [item('i1', 'Хуа Чэн брелок', { sku: 'TGCF-BR-01' }), item('i2', 'Венти', { fandom: 'genshin' })]
  const collects = [{ id: 'c1', name: 'Акрил партия', vendor: 'PrintLab' } as Collect]

  it('ranks a matching customer above an order that merely contains the item', () => {
    const r = searchAll('hua', { orders })
    expect(r.orders.map((o) => o.id)).toEqual(['o2'])
    expect(searchAll('хуа', { orders }).orders.map((o) => o.id)).toEqual(['o1'])
  })

  it('matches catalog items by SKU and fandom, case-insensitively', () => {
    expect(searchAll('tgcf-br', { items }).items.map((i) => i.id)).toEqual(['i1'])
    expect(searchAll('GENSHIN', { items }).items.map((i) => i.id)).toEqual(['i2'])
  })

  it('matches collects by vendor', () => {
    expect(searchAll('printlab', { collects }).collects).toHaveLength(1)
  })

  it('finds nothing for a blank query', () => {
    expect(searchAll('  ', { orders, items, collects })).toEqual({ orders: [], items: [], collects: [] })
  })
})
