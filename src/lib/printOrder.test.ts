import { describe, expect, it } from 'vitest'
import type { OrderItem } from './types'
import { esc, itemRowsHtml, ORDER_LIST_CSS, printPageHtml, RECEIPT_CSS, receiptBodyHtml, SINGLE_ORDER_CSS, statusParts } from './printOrder'

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

const receiptOrder = {
  id: 'aaaabbbb-cccc-dddd-eeee-ffffgggghhhh',
  telegram: '@testuser',
  customer_email: null,
  total_price: 1500,
  delivery_method: 'сдэк',
  paid: true,
  created_at: '2026-01-15T12:00:00Z',
}

describe('receiptBodyHtml', () => {
  it('renders the receipt wrapper with stamp, items and total', () => {
    const html = receiptBodyHtml(receiptOrder, [line('1', 'a', 500, 3)], catalog)
    expect(html).toContain('class="receipt"')
    expect(html).toContain('class="stamp"')
    expect(html).toContain('class="items"')
    expect(html).toContain('class="total"')
  })

  it('escapes customer names in the meta line', () => {
    const order = { ...receiptOrder, telegram: '<script>xss</script>' }
    const html = receiptBodyHtml(order, [], catalog)
    expect(html).toContain('&lt;script&gt;xss&lt;/script&gt;')
    expect(html).not.toContain('<script>xss</script>')
  })

  it('escapes item names from the catalog', () => {
    const html = receiptBodyHtml(receiptOrder, [line('1', 'b', 200)], catalog)
    expect(html).toContain('Fish &amp; Chips &lt;deluxe&gt;')
  })

  it('shows qty breakdown for multi-quantity items', () => {
    const html = receiptBodyHtml(receiptOrder, [line('1', 'a', 100, 3)], catalog)
    expect(html).toContain('3 &times;')
    expect(html).toContain('item-qty')
  })

  it('omits qty breakdown for single-quantity items', () => {
    const html = receiptBodyHtml(receiptOrder, [line('1', 'a', 100, 1)], catalog)
    expect(html).not.toContain('item-qty')
  })

  it('includes the delivery method when present', () => {
    const html = receiptBodyHtml(receiptOrder, [], catalog)
    expect(html).toContain('Delivery:')
    expect(html).toContain('сдэк')
  })

  it('shows the paid badge when paid', () => {
    const html = receiptBodyHtml(receiptOrder, [], catalog)
    expect(html).toContain('class="badge"')
    expect(html).toContain('Paid')
  })

  it('omits the paid badge when unpaid', () => {
    const html = receiptBodyHtml({ ...receiptOrder, paid: false }, [], catalog)
    expect(html).not.toContain('class="badge"')
  })

  it('truncates a long order ID to a short form', () => {
    const html = receiptBodyHtml(receiptOrder, [], catalog)
    expect(html).toContain('aaaa…hhhh')
    expect(html).not.toContain(receiptOrder.id)
  })

  it('includes a QR code SVG linking to the shop', () => {
    const html = receiptBodyHtml(receiptOrder, [], catalog)
    expect(html).toContain('class="qr"')
    expect(html).toContain('<svg')
    expect(html).toContain('t.me/hehearse_exe')
  })

  it('renders the thank-you message in Russian', () => {
    const html = receiptBodyHtml(receiptOrder, [], catalog)
    expect(html).toContain('Спасибо за покупку!')
  })

  it('RECEIPT_CSS styles the classes the body emits', () => {
    expect(RECEIPT_CSS).toContain('.receipt')
    expect(RECEIPT_CSS).toContain('.stamp')
    expect(RECEIPT_CSS).toContain('.item-name')
    expect(RECEIPT_CSS).toContain('.item-dots')
    expect(RECEIPT_CSS).toContain('.total')
    expect(RECEIPT_CSS).toContain('.qr')
  })
})
