/**
 * Minimal QR code generator for receipt printing.
 * Byte-mode encoding, EC Level L, auto-selects Version 1–3 (up to 53 chars).
 */

interface VersionInfo {
  size: number
  dataCW: number
  ecCW: number
  maxBytes: number
  align: number[]
}

const VERSIONS: VersionInfo[] = [
  { size: 21, dataCW: 19, ecCW: 7, maxBytes: 17, align: [] },
  { size: 25, dataCW: 34, ecCW: 10, maxBytes: 32, align: [6, 18] },
  { size: 29, dataCW: 55, ecCW: 15, maxBytes: 53, align: [6, 22] },
]

// GF(256) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x = (x << 1) ^ (x & 128 ? 0x11d : 0)
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}

function gfMul(a: number, b: number): number {
  return a && b ? EXP[LOG[a] + LOG[b]] : 0
}

function rsGenPoly(n: number): number[] {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const ng = new Array<number>(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= gfMul(g[j], EXP[i])
      ng[j + 1] ^= g[j]
    }
    g = ng
  }
  return g
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount)
  const r = new Uint8Array(data.length + ecCount)
  r.set(data)
  for (let i = 0; i < data.length; i++) {
    const c = r[i]
    if (c) for (let j = 0; j < gen.length; j++) r[i + j] ^= gfMul(gen[j], c)
  }
  return r.slice(data.length)
}

function pad8(n: number): string {
  return n.toString(2).padStart(8, '0')
}

function encodeData(text: string, dataCW: number): Uint8Array {
  let bits = '0100' + pad8(text.length)
  for (let i = 0; i < text.length; i++) bits += pad8(text.charCodeAt(i))
  bits += '0000'
  while (bits.length % 8) bits += '0'

  const data = new Uint8Array(dataCW)
  const filled = bits.length / 8
  for (let i = 0; i < filled; i++) data[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  for (let i = filled; i < dataCW; i++) data[i] = (i - filled) % 2 ? 0x11 : 0xec
  return data
}

type Matrix = Uint8Array[]

function matrix(size: number): Matrix {
  return Array.from({ length: size }, () => new Uint8Array(size))
}

function placeFinder(m: Matrix, res: Matrix, size: number, sr: number, sc: number): void {
  for (let r = -1; r <= 7; r++)
    for (let c = -1; c <= 7; c++) {
      const mr = sr + r, mc = sc + c
      if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue
      m[mr][mc] =
        r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          ? 1 : 0
      res[mr][mc] = 1
    }
}

function placeAlignment(m: Matrix, res: Matrix, positions: number[]): void {
  for (const row of positions)
    for (const col of positions) {
      if (res[row]?.[col]) continue
      for (let r = -2; r <= 2; r++)
        for (let c = -2; c <= 2; c++) {
          if (res[row + r][col + c]) continue
          m[row + r][col + c] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (!r && !c)) ? 1 : 0
          res[row + r][col + c] = 1
        }
    }
}

const MASK_FNS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => ((r >> 1) + ((c / 3) | 0)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function applyMask(m: Matrix, res: Matrix, size: number, fn: (r: number, c: number) => boolean): Matrix {
  const out = matrix(size)
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      out[r][c] = res[r][c] ? m[r][c] : (m[r][c] ^ (fn(r, c) ? 1 : 0)) as 0 | 1
  return out
}

function penalty(mx: Matrix, size: number): number {
  let s = 0
  for (let r = 0; r < size; r++) {
    let n = 1
    for (let c = 1; c < size; c++) {
      if (mx[r][c] === mx[r][c - 1]) n++
      else { if (n >= 5) s += n - 2; n = 1 }
    }
    if (n >= 5) s += n - 2
  }
  for (let c = 0; c < size; c++) {
    let n = 1
    for (let r = 1; r < size; r++) {
      if (mx[r][c] === mx[r - 1][c]) n++
      else { if (n >= 5) s += n - 2; n = 1 }
    }
    if (n >= 5) s += n - 2
  }
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (mx[r][c] === mx[r][c + 1] && mx[r][c] === mx[r + 1][c] && mx[r][c] === mx[r + 1][c + 1])
        s += 3
  return s
}

function placeFormatInfo(mx: Matrix, size: number, mask: number): void {
  const data = (1 << 3) | mask
  let bch = data << 10
  for (let i = 14; i >= 10; i--) if (bch & (1 << i)) bch ^= 0x537 << (i - 10)
  const fmt = ((data << 10) | bch) ^ 0x5412

  const p1: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]
  const p2: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ]

  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> (14 - i)) & 1) as 0 | 1
    mx[p1[i][0]][p1[i][1]] = bit
    mx[p2[i][0]][p2[i][1]] = bit
  }
}

/** Generate a QR code as an SVG string. Throws if text exceeds 53 bytes. */
export function generateQrSvg(text: string, moduleSize = 3, quiet = 4): string {
  const ver = VERSIONS.find((v) => text.length <= v.maxBytes)
  if (!ver) throw new Error(`Text too long for QR (max ${VERSIONS[VERSIONS.length - 1].maxBytes} bytes)`)

  const { size, dataCW, ecCW, align } = ver

  const data = encodeData(text, dataCW)
  const ec = rsEncode(data, ecCW)
  const all = new Uint8Array(dataCW + ecCW)
  all.set(data)
  all.set(ec, dataCW)

  const m = matrix(size)
  const res = matrix(size)

  placeFinder(m, res, size, 0, 0)
  placeFinder(m, res, size, 0, size - 7)
  placeFinder(m, res, size, size - 7, 0)
  if (align.length) placeAlignment(m, res, align)

  for (let i = 8; i < size - 8; i++) {
    if (!res[6][i]) { m[6][i] = i % 2 === 0 ? 1 : 0; res[6][i] = 1 }
    if (!res[i][6]) { m[i][6] = i % 2 === 0 ? 1 : 0; res[i][6] = 1 }
  }
  m[size - 8][8] = 1
  res[size - 8][8] = 1

  for (let i = 0; i <= 8; i++) { res[8][i] = 1; res[i][8] = 1 }
  for (let i = size - 8; i < size; i++) res[8][i] = 1
  for (let i = size - 7; i < size; i++) res[i][8] = 1

  let bits = ''
  for (const b of all) bits += pad8(b)
  let bi = 0
  let up = true
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5
    for (let si = 0; si < size; si++) {
      const row = up ? size - 1 - si : si
      for (const d of [0, 1]) {
        const cc = col - d
        if (cc >= 0 && !res[row][cc] && bi < bits.length)
          m[row][cc] = (bits.charCodeAt(bi++) - 48) as 0 | 1
      }
    }
    up = !up
  }

  let bestMask = 0, bestScore = Infinity
  for (let i = 0; i < 8; i++) {
    const masked = applyMask(m, res, size, MASK_FNS[i])
    const s = penalty(masked, size)
    if (s < bestScore) { bestScore = s; bestMask = i }
  }

  const final = applyMask(m, res, size, MASK_FNS[bestMask])
  placeFormatInfo(final, size, bestMask)

  const svgSize = (size + quiet * 2) * moduleSize
  const rects: string[] = []
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (final[r][c])
        rects.push(`<rect x="${(c + quiet) * moduleSize}" y="${(r + quiet) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`)

  return `<svg viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`
}
