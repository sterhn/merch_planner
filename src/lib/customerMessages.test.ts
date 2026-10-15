import { describe, expect, it } from 'vitest'
import type { OrderItem } from './types'
import { formatRub } from './format'
import { customerMessages, telegramLink } from './customerMessages'

const line = (id: string, item_id: string | null, name_text: string | null, qty: number, unit_price: number | null) =>
  ({ id, item_id, name_text, qty, unit_price, position: null }) as OrderItem
const catalog = new Map([['i1', { name: 'Значок Се Лянь' }]])
const base: Parameters<typeof customerMessages>[0] = { total_price: 650, paid: false, sent: false, delivered: false, delivery_method: 'сдэк', shipping_fee: 200, discount: null }
const lines = [line('a', null, 'Открытка', 1, 50), line('b', 'i1', null, 2, 200)]
const byKey = (order = base) => Object.fromEntries(customerMessages(order, lines, catalog).map((m) => [m.key, m]))

describe('customerMessages', () => {
  it('summarises the items priciest first, with shipping and the total', () => {
    expect(byKey().summary.text).toBe(
      [
        'Здравствуйте! Ваш заказ:',
        `• Значок Се Лянь ×2 — ${formatRub(400)}`,
        `• Открытка — ${formatRub(50)}`,
        `Доставка — ${formatRub(200)}`,
        `Итого: ${formatRub(650)}`,
      ].join('\n'),
    )
  })

  it('suggests the message that fits the status', () => {
    const suggested = (o: typeof base) => customerMessages(o, lines, catalog).find((m) => m.suggested)!.key
    expect(suggested(base)).toBe('reminder')
    expect(suggested({ ...base, paid: true })).toBe('paid')
    expect(suggested({ ...base, paid: true, sent: true })).toBe('sent')
    expect(suggested({ ...base, paid: true, sent: true, delivered: true })).toBe('thanks')
  })

  it('names the carrier when sent, and switches to pickup wording for самовывоз', () => {
    expect(byKey().sent.text).toContain('отправлен через СДЭК')
    const pickup = byKey({ ...base, delivery_method: 'самовывоз спб' }).sent
    expect(pickup.title).toBe('Ready for pickup')
    expect(pickup.text).toContain('самовывоза в Санкт-Петербурге')
  })

  it('falls back to the items total when the order has no total yet', () => {
    expect(byKey({ ...base, total_price: null }).reminder.text).toContain(formatRub(650))
  })

  it('never uses gendered past-tense verbs', () => {
    const all = customerMessages(base, lines, catalog).map((m) => m.text).join(' ')
    expect(all).not.toMatch(/получила|получил |отправила|отправил /)
  })
})

describe('telegramLink', () => {
  it('accepts @handles, bare handles and t.me links', () => {
    expect(telegramLink('@bob_shop')).toBe('https://t.me/bob_shop')
    expect(telegramLink('bob_shop')).toBe('https://t.me/bob_shop')
    expect(telegramLink('https://t.me/bob_shop')).toBe('https://t.me/bob_shop')
  })

  it('rejects things that are not usernames', () => {
    expect(telegramLink('@bob')).toBeNull()
    expect(telegramLink('+7 900 000 00 00')).toBeNull()
    expect(telegramLink(null)).toBeNull()
  })
})
