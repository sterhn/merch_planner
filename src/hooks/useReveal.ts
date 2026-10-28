import { useCallback, useState } from 'react'

/** Rows added each time the end of the list comes into view. */
const STEP = 40

/**
 * Long lists render a screenful or two at first and grow as you scroll, so a
 * page with hundreds of glass rows opens at once instead of building (and
 * blurring) every row up front. The count starts over when `resetKey`
 * changes — a new filter or search shows its own first page.
 */
export function useReveal(total: number, resetKey: string, initial = STEP) {
  const [state, setState] = useState({ key: resetKey, count: initial })
  const limit = state.key === resetKey ? state.count : initial
  const more = useCallback(
    () => setState((s) => ({ key: resetKey, count: (s.key === resetKey ? s.count : initial) + STEP })),
    [resetKey, initial],
  )
  return { limit, hasMore: total > limit, more }
}
