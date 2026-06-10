import { describe, expect, it } from 'vitest'
import { normalizeName, parseCell, parseFragment, splitFragments } from './parse-items'

describe('splitFragments', () => {
  it('splits on commas outside parentheses', () => {
    expect(splitFragments('брелок kdj (500 р), гробик юхён (300 р)')).toEqual([
      'брелок kdj (500 р)',
      'гробик юхён (300 р)',
    ])
  })

  it('keeps commas inside parentheses', () => {
    expect(splitFragments('сет (брелок, значок) (900 р), орв kdj (150 р)')).toEqual([
      'сет (брелок, значок) (900 р)',
      'орв kdj (150 р)',
    ])
  })

  it('drops empty fragments', () => {
    expect(splitFragments(' , брелок (500 р),  ')).toEqual(['брелок (500 р)'])
  })
})

describe('parseFragment', () => {
  it('parses a standard "name (NNN р)" fragment', () => {
    expect(parseFragment('брелок kdj (500 р)')).toEqual({
      name: 'брелок kdj',
      price: 500,
      raw: 'брелок kdj (500 р)',
    })
  })

  it('parses price glued to the name without a space', () => {
    expect(parseFragment('гача 1 крутка(150р)')).toEqual({
      name: 'гача 1 крутка',
      price: 150,
      raw: 'гача 1 крутка(150р)',
    })
  })

  it('parses zero-price swaps', () => {
    expect(parseFragment('своп орв (0 р)')).toMatchObject({ name: 'своп орв', price: 0 })
  })

  it('handles double spaces before the price', () => {
    expect(parseFragment('юджин (150  р)')).toMatchObject({ name: 'юджин', price: 150 })
  })

  it('keeps bracketed item names intact', () => {
    expect(parseFragment('конфета [good child candy] (600р)')).toMatchObject({
      name: 'конфета [good child candy]',
      price: 600,
    })
  })

  it('falls back to free text when there is no price', () => {
    expect(parseFragment('сердечко юхён + юджин')).toEqual({
      name: 'сердечко юхён + юджин',
      price: null,
      raw: 'сердечко юхён + юджин',
    })
  })
})

describe('parseCell', () => {
  it('returns empty for empty cells', () => {
    expect(parseCell(null)).toEqual([])
    expect(parseCell('')).toEqual([])
    expect(parseCell('   ')).toEqual([])
  })

  it('parses a real multi-item cell', () => {
    const result = parseCell('гача 1 крутка(150р), storypack шейкер (600р), шейкер соён (500р)')
    expect(result).toHaveLength(3)
    expect(result.map((f) => f.price)).toEqual([150, 600, 500])
  })
})

describe('normalizeName', () => {
  it('lowercases, collapses spaces and maps ё to е', () => {
    expect(normalizeName('  Гробик  Юхён ')).toBe('гробик юхен')
  })
})
