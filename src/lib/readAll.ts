/**
 * Rows per request: PostgREST's max-rows cap as Supabase ships it. A read that
 * comes back this long may have been cut short.
 */
export const PAGE_SIZE = 1000

type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>

/**
 * Every row a read matches, past PostgREST's max-rows cap — which truncates a
 * plain select without saying so. Past 1000 orders the dashboard would quietly
 * have under-counted revenue.
 *
 * `read(from, to)` fetches one page. The first page is taken as it comes, so a
 * table that fits is read exactly as before, in one request. Only a full first
 * page sends the whole read round again, page by page, through
 * `ordered(from, to)` — which must sort on something unique, because OFFSET
 * over an unsorted read isn't guaranteed to be stable between requests.
 *
 * Pages are offset/limit query parameters rather than a Range header, so every
 * response is still a plain 200 the service worker caches for offline use.
 * Lives outside useTable.ts so its test runs without the Supabase client.
 */
export async function readAll<T>(
  read: (from: number, to: number) => Page,
  ordered: (from: number, to: number) => Page = read,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const first = await read(0, pageSize - 1)
  if (first.error) throw first.error
  const rows = (first.data ?? []) as T[]
  if (rows.length < pageSize) return rows

  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await ordered(from, from + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < pageSize) return all
  }
}
