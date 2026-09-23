import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { readAll } from '../lib/readAll'
import { sortRows } from '../lib/sortRows'

interface ListOptions {
  orderBy?: string
  ascending?: boolean
  /** Where nulls land. Defaults to Postgres's rule (last asc, first desc). */
  nullsFirst?: boolean
  select?: string
}

/**
 * The sort deliberately stays out of the query key: the same table read with two
 * different `orderBy`s is the same set of rows, and keying on it split `items`
 * across three cache entries (and three requests) per session. The select string
 * does stay in the key — it changes which columns and embeds come back.
 */
export function useList<T>(table: string, opts: ListOptions = {}) {
  const { orderBy, ascending = true, nullsFirst, select = '*' } = opts

  // Memoised so TanStack doesn't re-sort on every render — it only re-runs
  // `select` when the data or this function reference changes.
  const sort = useCallback(
    (rows: T[]) => (orderBy ? sortRows(rows, orderBy, ascending, nullsFirst) : rows),
    [orderBy, ascending, nullsFirst],
  )

  return useQuery({
    queryKey: [table, select],
    // Paged past PostgREST's 1000-row cap; every table (and expense_feed) has
    // a unique `id` to hold the page order steady.
    queryFn: () =>
      readAll<T>(
        (from, to) => supabase.from(table).select(select).range(from, to),
        (from, to) => supabase.from(table).select(select).order('id').range(from, to),
      ),
    select: sort,
  })
}

interface MutationOpts {
  /**
   * Skip the global "Save failed" toast for this mutation. For forms that catch
   * the error themselves and show it inline — without this, one failure surfaces
   * as two differently-worded messages at once.
   */
  suppressErrorToast?: boolean
}

export function useInsert<T extends object>(table: string, invalidate: string[] = [], opts: MutationOpts = {}) {
  const qc = useQueryClient()
  return useMutation({
    meta: { suppressErrorToast: opts.suppressErrorToast },
    mutationFn: async (values: Partial<T>) => {
      const { data, error } = await supabase.from(table).insert(values as never).select().single()
      if (error) throw error
      return data as T
    },
    onSuccess: () => {
      for (const key of [table, ...invalidate]) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

export function useUpdate<T extends object>(table: string, invalidate: string[] = [], opts: MutationOpts = {}) {
  const qc = useQueryClient()
  return useMutation({
    meta: { suppressErrorToast: opts.suppressErrorToast },
    mutationFn: async ({ id, values }: { id: string; values: Partial<T> }) => {
      const { error } = await supabase.from(table).update(values as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      for (const key of [table, ...invalidate]) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

export function useDelete(table: string, invalidate: string[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      for (const key of [table, ...invalidate]) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}
