import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { readSettings, SETTING_KEYS, type Settings } from '../lib/settings'

/**
 * The migration number this build of the app expects. Bump it together with
 * each new file in supabase/migrations/ (which must end by inserting the same
 * number into schema_migrations).
 */
export const SCHEMA_VERSION = 10

/** Before migration 010 there is no schema_migrations table at all. */
const PRE_TRACKING_VERSION = 9

// PostgREST reports a missing table as PGRST205 (older servers: Postgres 42P01).
const MISSING_TABLE = new Set(['PGRST205', '42P01'])

/** Highest migration applied to the database. */
export function useSchemaVersion() {
  return useQuery({
    queryKey: ['schema_migrations'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('schema_migrations')
        .select('version')
        .order('version', { ascending: false })
        .limit(1)
      if (error) {
        if (MISSING_TABLE.has(error.code)) return PRE_TRACKING_VERSION
        // A network failure says nothing about the schema — no banner for it.
        throw error
      }
      return (data?.[0] as { version: number } | undefined)?.version ?? PRE_TRACKING_VERSION
    },
    retry: false,
  })
}

/** App preferences, with defaults while loading or before migration 010. */
export function useSettings(): { settings: Settings; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
      if (error) throw error
      return data as { key: string; value: unknown }[]
    },
    retry: false,
  })
  return { settings: readSettings(data), isLoading }
}

export function useSaveSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: keyof Settings; value: Settings[keyof Settings] }) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: SETTING_KEYS[key], value, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings'] }),
  })
}
