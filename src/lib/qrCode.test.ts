import { describe, expect, it } from 'vitest'
import { generateQrSvg } from './qrCode'

describe('generateQrSvg', () => {
  it('returns an SVG element for short text', () => {
    const svg = generateQrSvg('hello')
    expect(svg).toMatch(/^<svg\s/)
    expect(svg).toMatch(/<\/svg>$/)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('contains dark modules as <rect> elements', () => {
    const svg = generateQrSvg('test')
    expect(svg).toContain('<rect')
  })

  it('uses the requested module size', () => {
    const svg = generateQrSvg('hi', 5)
    expect(svg).toContain('width="5"')
    expect(svg).toContain('height="5"')
  })

  it('selects version 1 for short text (≤17 bytes)', () => {
    const svg = generateQrSvg('short')
    // Version 1: 21 modules + 2×4 quiet = 29, ×3 = 87
    expect(svg).toContain('viewBox="0 0 87 87"')
  })

  it('selects version 2 for medium text (18–32 bytes)', () => {
    const svg = generateQrSvg('a]medium-length string!')
    expect(svg).toContain('viewBox="0 0 99 99"')
  })

  it('handles the Telegram URL used by receipts', () => {
    const svg = generateQrSvg('https://t.me/hehearse_exe')
    expect(svg).toMatch(/^<svg\s/)
    expect(svg).toContain('<rect')
  })

  it('throws for text exceeding 53 bytes', () => {
    const long = 'x'.repeat(54)
    expect(() => generateQrSvg(long)).toThrow(/too long/i)
  })

  it('produces deterministic output for the same input', () => {
    const a = generateQrSvg('stable')
    const b = generateQrSvg('stable')
    expect(a).toBe(b)
  })
})
