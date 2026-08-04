/**
 * A message worth showing the user for a failed Supabase call.
 *
 * These used to be reported as "check your connection", which is actively
 * misleading: a missing column or a constraint violation is not a network
 * problem, and the real cause (a PostgREST code like PGRST204) was discarded.
 * Keep the hint, but never at the cost of the actual reason.
 */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [e.message, e.details, e.hint].filter((p): p is string => typeof p === 'string' && p !== '')
    if (parts.length > 0) {
      const code = typeof e.code === 'string' && e.code ? ` (${e.code})` : ''
      return parts.join(' — ') + code
    }
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Unknown error'
}

/** Prefixes the reason with what was being attempted. */
export function failureMessage(action: string, error: unknown): string {
  return `${action} failed: ${errorMessage(error)}`
}
