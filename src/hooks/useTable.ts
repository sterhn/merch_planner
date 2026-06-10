import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface ListOptions {
  orderBy?: string
  ascending?: boolean
}

export function useList<T>(table: string, opts: ListOptions = {}) {
  return useQuery({
    queryKey: [table],
    queryFn: async (): Promise<T[]> => {
      let query = supabase.from(table).select('*')
      if (opts.orderBy) query = query.order(opts.orderBy, { ascending: opts.ascending ?? true })
      const { data, error } = await query
      if (error) throw error
      return data as T[]
    },
  })
}

export function useInsert<T extends object>(table: string, invalidate: string[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<T>) => {
      const { error } = await supabase.from(table).insert(values as never)
      if (error) throw error
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
