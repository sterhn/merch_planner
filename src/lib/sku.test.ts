import { describe, expect, it } from 'vitest'
import { nextSku, skuIssues } from './sku'

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
  it('drops spaces from a multi-word fandom', () => {
    expect(nextSku('[Mo Dao]', 'шейкер', [])).toBe('MODAO-SH-01')
  })
})

describe('skuIssues', () => {
  const item = (sku: string | null, type: string | null, fandom: string | null) => ({ sku, type, fandom })

  it('passes SKUs that follow the convention', () => {
    expect(skuIssues(item('MSCH-SH-04', 'шейкер', '[MSCH]'))).toEqual([])
    expect(skuIssues(item('ORV-03', 'постер', '[ORV]'))).toEqual([])
    expect(skuIssues(item(null, 'шейкер', '[MSCH]'))).toEqual([])
  })
  it('accepts any code on a type that has none yet, and any prefix without a fandom', () => {
    expect(skuIssues(item('ORV-PO-01', 'постер', '[ORV]'))).toEqual([])
    expect(skuIssues(item('X-K-01', 'брелок', null))).toEqual([])
  })
  it('flags a type code that no longer matches the type', () => {
    expect(skuIssues(item('MSCH-K-07', 'значок', '[MSCH]'))).toEqual(['type code K, but значок is B'])
  })
  it('flags the old FANDOM-NN style on a type that has a code', () => {
    expect(skuIssues(item('MSCH-07', 'брелок', '[MSCH]'))).toEqual(['no type code (брелок is K)'])
  })
  it('flags a prefix that is not the fandom', () => {
    expect(skuIssues(item('GS-K-01', 'брелок', '[GSGW]'))).toEqual(['starts GS, but the fandom is GSGW'])
  })
  it('flags malformed SKUs', () => {
    expect(skuIssues(item('msch k1', 'брелок', '[MSCH]'))).toEqual(['not in FANDOM-TYPE-NN form'])
    expect(skuIssues(item('MSCH-K-1', 'брелок', '[MSCH]'))).toEqual(['not in FANDOM-TYPE-NN form'])
    expect(skuIssues(item(' MSCH-K-01', 'брелок', '[MSCH]'))).toEqual(['not in FANDOM-TYPE-NN form'])
  })
  it('passes every SKU nextSku hands out', () => {
    for (const [fandom, type] of [['[MSCH]', 'шейкер'], ['[ORV]', 'постер'], ['[Mo Dao]', 'открытка А5']]) {
      expect(skuIssues(item(nextSku(fandom, type, ['MSCH-SH-09']), type, fandom))).toEqual([])
    }
  })
})
