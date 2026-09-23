import { describe, expect, it } from 'vitest'
import { readAll } from './readAll'

/** A table of `total` rows behind a server that returns at most `cap` per request. */
function table(total: number, { cap = 3, failFrom }: { cap?: number; failFrom?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }))
  const calls: string[] = []
  const pager = (kind: string) => (from: number, to: number) => {
    calls.push(`${kind} ${from}-${to}`)
    if (kind === 'ordered' && from === failFrom) return Promise.resolve({ data: null, error: new Error('boom') })
    return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null })
  }
  return { rows, calls, read: pager('read'), ordered: pager('ordered') }
}

describe('readAll', () => {
  it('reads a table that fits in one request, as-is', async () => {
    const t = table(2)
    expect(await readAll(t.read, t.ordered, 3)).toEqual(t.rows)
    expect(t.calls).toEqual(['read 0-2'])
  })

  it('pages through in a fixed order once the first page comes back full', async () => {
    const t = table(7)
    expect(await readAll(t.read, t.ordered, 3)).toEqual(t.rows)
    expect(t.calls).toEqual(['read 0-2', 'ordered 0-2', 'ordered 3-5', 'ordered 6-8'])
  })

  it('stops on an empty page when the rows divide evenly', async () => {
    const t = table(6)
    expect(await readAll(t.read, t.ordered, 3)).toEqual(t.rows)
    expect(t.calls.at(-1)).toBe('ordered 6-8')
  })

  it('pages with the plain read when no ordered read is given', async () => {
    const t = table(4)
    expect(await readAll(t.read, undefined, 3)).toEqual(t.rows)
    expect(t.calls).toEqual(['read 0-2', 'read 0-2', 'read 3-5'])
  })

  it('rejects when any page fails, rather than returning a partial list', async () => {
    const failFirst = () => Promise.resolve({ data: null, error: new Error('down') })
    await expect(readAll(failFirst)).rejects.toThrow('down')
    const t = table(7, { failFrom: 3 })
    await expect(readAll(t.read, t.ordered, 3)).rejects.toThrow('boom')
  })
})
