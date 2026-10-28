import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * True when the page was opened with `?new=1` (the dashboard's quick actions
 * link that way to open a page's "add" sheet straight away). The flag is read
 * once, then stripped from the URL so a reload or Back doesn't reopen the sheet.
 */
export function useLaunchFlag(name = 'new'): boolean {
  return useLaunchParam(name) === '1'
}

/**
 * The value a page was opened with for `?name=…`, read once and then stripped
 * from the URL like useLaunchFlag (e.g. the item ids for a reprint).
 */
export function useLaunchParam(name: string): string | null {
  const [params, setParams] = useSearchParams()
  const [value] = useState(() => params.get(name))
  const present = params.has(name)
  useEffect(() => {
    if (!present) return
    setParams(
      (p) => {
        p.delete(name)
        return p
      },
      { replace: true },
    )
  }, [present, name, setParams])
  return value
}
