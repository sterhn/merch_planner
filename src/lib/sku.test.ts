import { describe, expect, it } from 'vitest'
import { nextSku } from './sku'

describe('nextSku', () => {
  it('continues the fandom + type series', () => {
    expect(nextSku('[MSCH]', 'шейкер', ['MSCH-SH-01', 'MSCH-SH-03', 'MSCH-K-07'])).toBe('MSCH-SH-04')
  })
  it('starts a new series at 01', () => {
    expect(nextSku('[OC]', 'брелок', ['MSCH-K-05'])).toBe('OC-K-01')
  })
  it('counts up the plain series for types without a code instead of repeating 01', () => {
    expect(nextSku('[ORV]', 'постер', ['ORV-01', 'ORV-02', 'ORV-SH-05'])).toBe('ORV-03')
    expect(nextSku('[ORV]', '', [])).toBe('ORV-01')
  })
  it('ignores other fandoms that share a prefix, and non-numeric tails', () => {
    expect(nextSku('[OC]', 'брелок', ['OCX-K-09', 'OC-K-1a', null])).toBe('OC-K-01')
  })
  it('strips the brackets and upper-cases the fandom', () => {
    expect(nextSku('[msch]', 'значок', [])).toBe('MSCH-B-01')
  })
  it('is empty without a fandom', () => {
    expect(nextSku('', 'шейкер', [])).toBe('')
    expect(nextSku('[]', 'шейкер', [])).toBe('')
  })
})
