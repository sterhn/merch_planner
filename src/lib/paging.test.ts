import { describe, expect, it } from 'vitest'
import { chunk, fetchAllPages } from './paging'

/** A fake table of `total` rows served `pageSize` at a time. */
function table(total: number) {
  const calls: [number, number][] = []
  const rows = Array.from({ length: total }, (_, i) => i)
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to])
    return rows.slice(from, to + 1)
  }
  return { calls, fetchPage }
}

describe('fetchAllPages', () => {
  it('reads a small table in one request', async () => {
    const t = table(3)
    expect(await fetchAllPages(t.fetchPage, 10)).toEqual([0, 1, 2])
    expect(t.calls).toEqual([[0, 9]])
  })

  it('keeps reading past the first page', async () => {
    const t = table(25)
    const rows = await fetchAllPages(t.fetchPage, 10)
    expect(rows).toHaveLength(25)
    expect(rows[24]).toBe(24)
    expect(t.calls).toEqual([[0, 9], [10, 19], [20, 29]])
  })

  it('asks once more when the table is an exact multiple of the page size', async () => {
    const t = table(20)
    expect(await fetchAllPages(t.fetchPage, 10)).toHaveLength(20)
    expect(t.calls).toHaveLength(3)
  })

  it('passes errors through', async () => {
    await expect(fetchAllPages(async () => { throw new Error('boom') }, 10)).rejects.toThrow('boom')
  })
})

describe('chunk', () => {
  it('splits into runs of at most size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})
