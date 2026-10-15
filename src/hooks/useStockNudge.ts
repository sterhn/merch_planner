import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Item } from '../lib/types'
import { supabase } from '../lib/supabase'
import { failureMessage } from '../lib/errorMessage'
import { showToast } from '../lib/toast'
import { haptic } from '../lib/haptics'

/** How long the count waits for more taps before it's saved. */
const SETTLE_MS = 700

interface Pending {
  value: number
  timer: ReturnType<typeof setTimeout>
}

/**
 * Quick stock +/− from the catalog list. Each tap updates the cached count at
 * once; the database gets one write per burst of taps (the final value), so
 * five quick taps can't race each other or be undone by a refetch landing
 * between them.
 */
export function useStockNudge() {
  const qc = useQueryClient()
  const pending = useRef(new Map<string, Pending>())

  const save = useCallback(
    async (id: string, value: number) => {
      pending.current.delete(id)
      const { error } = await supabase.from('items').update({ stock_qty: value }).eq('id', id)
      if (error) showToast(failureMessage('Stock update', error))
      void qc.invalidateQueries({ queryKey: ['items'] })
    },
    [qc],
  )

  // Leaving the page mid-burst still saves the last count.
  useEffect(() => {
    const map = pending.current
    return () => {
      for (const [id, p] of map) {
        clearTimeout(p.timer)
        void save(id, p.value)
      }
    }
  }, [save])

  return useCallback(
    (item: Item, delta: number) => {
      haptic(5)
      const prev = pending.current.get(item.id)
      const value = (prev?.value ?? item.stock_qty ?? 0) + delta
      if (prev) clearTimeout(prev.timer)
      qc.setQueriesData<Item[]>({ queryKey: ['items'] }, (data) =>
        Array.isArray(data) ? data.map((i) => (i.id === item.id ? { ...i, stock_qty: value } : i)) : data,
      )
      pending.current.set(item.id, { value, timer: setTimeout(() => void save(item.id, value), SETTLE_MS) })
    },
    [qc, save],
  )
}
