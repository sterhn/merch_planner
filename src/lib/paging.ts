// Supabase (PostgREST) returns at most 1000 rows per request — a read with no
// range silently stops there. Every list read pages through with this so
// totals stay right once a table outgrows one page.

export const PAGE_SIZE = 1000

/**
 * Calls `fetchPage(from, to)` (inclusive row bounds, as `.range()` takes them)
 * until a page comes back short, and returns every row in order. The query
 * behind it needs a stable order (e.g. by id), or rows can shift between pages.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/** Splits `items` into runs of at most `size` (for ids that travel in a URL). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
