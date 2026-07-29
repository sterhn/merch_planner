import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session)
      })
      // A rejected getSession (expired refresh token, no network on a cold start)
      // used to leave `loading` pinned true — a permanent full-page spinner with no
      // way out. Fall through to the login screen instead.
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (alive) setSession(s)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}

/** Signs out and drops the previous session's cached rows. */
export function useSignOut() {
  const qc = useQueryClient()
  return useCallback(async () => {
    await supabase.auth.signOut()
    qc.clear()
  }, [qc])
}
