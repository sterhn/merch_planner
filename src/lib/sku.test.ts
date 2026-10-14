import { describe, expect, it } from 'vitest'
import { autoSku } from './sku'

describe('autoSku', () => {
  const items = [{ sku: 'MSCH-SH-03' }, { sku: 'MSCH-SH-01' }, { sku: 'MSCH-K-07' }, { sku: null }]

  it('continues after the highest SKU with the same fandom and type', () => {
    expect(autoSku('msch', 'шейкер', items)).toBe('MSCH-SH-04')
    expect(autoSku('msch', 'брелок', items)).toBe('MSCH-K-08')
  })

  it('starts at 01 for a new prefix, and strips brackets from the fandom', () => {
    expect(autoSku('[tgcf]', 'значок', items)).toBe('TGCF-B-01')
  })

  it('falls back to FANDOM-01 for types without a code, and nothing without a fandom', () => {
    expect(autoSku('kdj', 'что-то новое', items)).toBe('KDJ-01')
    expect(autoSku('', 'шейкер', items)).toBe('')
  })
})
