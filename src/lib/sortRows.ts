/**
 * Client-side equivalent of PostgREST's `.order(col, { ascending })`.
 *
 * useList sorts here rather than in the request so that the same table read with
 * two different sorts shares one cache entry. That makes this a compatibility
 * shim: it has to order exactly as the database did, including null placement —
 * last ascending, first descending — which it gets by treating null as greater
 * than every value and negating the whole comparison for descending.
 *
 * Lives outside useTable.ts on purpose: importing that module pulls in the
 * Supabase client, whose constructor needs a WebSocket global and throws under
 * the Node version CI runs the tests on.
 */
export function sortRows<T>(rows: T[], column: string, ascending: boolean): T[] {
  const key = column as keyof T
  return [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    let cmp: number
    if (x == null || y == null) {
      cmp = x == null ? (y == null ? 0 : 1) : -1
    } else if (typeof x === 'string' && typeof y === 'string') {
      // ru collation so Cyrillic names order sensibly rather than by code point.
      cmp = x.localeCompare(y, 'ru')
    } else {
      cmp = x < y ? -1 : x > y ? 1 : 0
    }
    return ascending ? cmp : -cmp
  })
}
