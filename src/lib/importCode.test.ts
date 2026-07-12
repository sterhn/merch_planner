import { describe, expect, it } from 'vitest'
import { importedOrderRows, parseImportCode } from './importCode'

const CODE = 'import:[{"id":"a1","name":"брелок браун","type":"брелок","qty":2,"price":650},{"id":"b2","name":"значок","type":null,"qty":1,"price":null}]'

// Exactly what the store page's buildTgMessage() produces.
const FULL_MESSAGE = `Привет! Хочу заказать:

• брелок браун (брелок) × 2 — 1 300 ₽
• значок × 1

Итого: 1 300 ₽

---
${CODE}`

describe('parseImportCode', () => {
  it('parses the bare import: code', () => {
    const lines = parseImportCode(CODE)
    expect(lines).toHaveLength(2)
    expect(lines![0]).toMatchObject({ id: 'a1', qty: 2, price: 650 })
  })

  it('finds the code inside a full shared Telegram message', () => {
    const lines = parseImportCode(FULL_MESSAGE)
    expect(lines).toHaveLength(2)
    expect(lines![1].name).toBe('значок')
  })

  it('survives names containing ] and trailing text after the code', () => {
    const tricky = 'import:[{"name":"конфета [good child]","qty":1}]\n\nспасибо!'
    expect(parseImportCode(tricky)![0].name).toBe('конфета [good child]')
  })

  it('accepts a bare JSON array without the import: prefix', () => {
    expect(parseImportCode(' [{"name":"x","qty":1}] ')).toHaveLength(1)
  })

  it('rejects text without a code, empty arrays, and broken JSON', () => {
    expect(parseImportCode('Привет! Хочу заказать значок')).toBeNull()
    expect(parseImportCode('import:[]')).toBeNull()
    expect(parseImportCode('import:[{"name":')).toBeNull()
  })
})

describe('importedOrderRows', () => {
  it('maps shared lines onto order_items rows', () => {
    const rows = importedOrderRows('o1', parseImportCode(FULL_MESSAGE)!)
    expect(rows[0]).toEqual({
      order_id: 'o1',
      item_id: 'a1',
      name_text: 'брелок браун',
      category: 'брелок',
      qty: 2,
      unit_price: 650,
      position: 0,
    })
    expect(rows[1].item_id).toBe('b2')
    expect(rows[1].unit_price).toBeNull()
  })

  it('appends after existing lines via basePosition', () => {
    const rows = importedOrderRows('o1', parseImportCode(CODE)!, 5)
    expect(rows.map((r) => r.position)).toEqual([5, 6])
  })
})
