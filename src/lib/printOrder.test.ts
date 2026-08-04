import { describe, expect, it } from 'vitest'
import type { OrderItem } from './types'
import { esc, itemRowsHtml, ORDER_LIST_CSS, printPageHtml, SINGLE_ORDER_CSS, statusParts } from './printOrder'

function line(id: string, item_id: string | null, unit_price: number | null, qty = 1): OrderItem {
  return { id, item_id, name_text: null, unit_price, qty } as OrderItem
}

const catalog = new Map([
  ['a', { name: 'Стикер' }],
  ['b', { name: 'Fish & Chips <deluxe>' }],
])

describe('esc', () => {
  it('escapes the characters that would break the document', () => {
    expect(esc('Fish & Chips')).toBe('Fish &amp; Chips')
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(esc(`He said "hi" and 'bye'`)).toBe('He said &quot;hi&quot; and &#39;bye&#39;')
  })
  it('leaves Cyrillic alone', () => {
    expect(esc('Стикер Значок')).toBe('Стикер Значок')
  })
  it('renders null and undefined as empty', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
  })
})

describe('statusParts', () => {
  it('marks each flag', () => {
    expect(statusParts({ paid: true, sent: false, delivered: false })).toEqual([
      '✓ Paid',
      '✗ Not sent',
      '✗ Not delivered',
    ])
  })
})

describe('itemRowsHtml', () => {
  it('escapes catalog names so a stray & cannot corrupt the table', () => {
    const html = itemRowsHtml([line('1', 'b', 100)], catalog)
    expect(html).toContain('Fish &amp; Chips &lt;deluxe&gt;')
    expect(html).not.toContain('<deluxe>')
  })

  it('multiplies price by quantity in the subtotal column', () => {
    const html = itemRowsHtml([line('1', 'a', 100, 3)], catalog)
    // 100 ₽ unit, 300 ₽ subtotal
    expect(html).toMatch(/100\s₽/u)
    expect(html).toMatch(/300\s₽/u)
  })

  it('falls back to an em dash when neither catalog nor free text names the line', () => {
    expect(itemRowsHtml([line('1', null, 50)], catalog)).toContain('—')
  })

  it('emits a heading row per group when grouping', () => {
    const html = itemRowsHtml([], catalog, [
      { fandom: 'Genshin', lines: [line('1', 'a', 100)] },
      { fandom: null, lines: [line('2', 'a', 50)] },
    ])
    expect(html).toContain('<tr class="group"><td colspan="4">Genshin</td></tr>')
    expect(html).toContain('<tr class="group"><td colspan="4">Other</td></tr>')
  })

  it('prints the flat list untouched when not grouping', () => {
    const html = itemRowsHtml([line('1', 'a', 100), line('2', 'a', 50)], catalog)
    expect(html).not.toContain('class="group"')
    expect(html.match(/<tr>/g)).toHaveLength(2)
  })
})

describe('printPageHtml', () => {
  it('wraps the body in a complete document with the given stylesheet', () => {
    const html = printPageHtml('Order – @user', SINGLE_ORDER_CSS, '<h1>@user</h1>')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<title>Order – @user</title>')
    expect(html).toContain(SINGLE_ORDER_CSS)
    expect(html).toContain('<h1>@user</h1>')
  })

  it('escapes the title — customer names are user-entered', () => {
    const html = printPageHtml('Order – <Fish & Chips>', ORDER_LIST_CSS, '')
    expect(html).toContain('<title>Order – &lt;Fish &amp; Chips&gt;</title>')
    expect(html).not.toContain('<title>Order – <Fish')
  })

  it('both stylesheets keep the class names the shared row builders emit', () => {
    for (const css of [SINGLE_ORDER_CSS, ORDER_LIST_CSS]) {
      expect(css).toContain('tr.group td')
      expect(css).toContain('.items-total')
      expect(css).toContain('.order-total')
    }
  })
})
