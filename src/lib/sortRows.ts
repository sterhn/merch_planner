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
export function sortRows<T>(
  rows: T[],
  column: string,
  ascending: boolean,
  /** Defaults to Postgres's own rule: nulls last ascending, first descending. */
  nullsFirst: boolean = !ascending,
): T[] {
  const key = column as keyof T
  return [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x == null || y == null) {
      if (x == null && y == null) return 0
      // Nulls go to whichever end was asked for, independent of the direction
      // the non-null values are sorted in.
      return (x == null ? 1 : -1) * (nullsFirst ? -1 : 1)
    }
    const cmp =
      typeof x === 'string' && typeof y === 'string'
        ? // ru collation so Cyrillic names order sensibly rather than by code point.
          x.localeCompare(y, 'ru')
        : x < y
          ? -1
          : x > y
            ? 1
            : 0
    return ascending ? cmp : -cmp
  })
}
