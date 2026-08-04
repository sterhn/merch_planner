import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface ListOptions {
  orderBy?: string
  ascending?: boolean
  select?: string
}

/**
 * The sort deliberately stays out of the query key: the same table read with two
 * different `orderBy`s is the same set of rows, and keying on it split `items`
 * across three cache entries (and three requests) per session. The select string
 * does stay in the key — it changes which columns and embeds come back.
 */
export function useList<T>(table: string, opts: ListOptions = {}) {
  const { orderBy, ascending = true, select = '*' } = opts

  // Memoised so TanStack doesn't re-sort on every render — it only re-runs
  // `select` when the data or this function reference changes.
  const sort = useCallback(
    (rows: T[]) => (orderBy ? sortRows(rows, orderBy, ascending) : rows),
    [orderBy, ascending],
  )

  return useQuery({
    queryKey: [table, select],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.from(table).select(select)
      if (error) throw error
      return data as T[]
    },
    select: sort,
  })
}

/**
 * Client-side equivalent of PostgREST's `.order(col, { ascending })`. Matches its
 * null handling — nulls last ascending, first descending — by treating null as
 * greater than every value and negating the whole comparison for descending.
 * Strings use ru collation so Cyrillic names order sensibly rather than by code
 * point.
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
      cmp = x.localeCompare(y, 'ru')
    } else {
      cmp = x < y ? -1 : x > y ? 1 : 0
    }
    return ascending ? cmp : -cmp
  })
}

export function useInsert<T extends object>(table: string, invalidate: string[] = []) {
  const qc = useQueryClient()
  return useMutation({
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

export function useUpdate<T extends object>(table: string, invalidate: string[] = []) {
  const qc = useQueryClient()
  return useMutation({
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
