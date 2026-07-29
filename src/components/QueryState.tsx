import { Loader2, type LucideIcon } from 'lucide-react'
import EmptyState from './EmptyState'

/**
 * The loading / error / empty triad every list page renders above its rows.
 * Returns null once there is data to show.
 */
export default function QueryState({
  isLoading,
  isError,
  isEmpty,
  icon,
  errorMessage,
  emptyMessage,
  emptyHint,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  icon: LucideIcon
  errorMessage: string
  emptyMessage: string
  emptyHint?: string
  onRetry?: () => void
}) {
  if (isLoading) return <EmptyState icon={Loader2} spin message="Loading…" />
  if (isError) return <EmptyState icon={icon} message={errorMessage} onRetry={onRetry} />
  if (isEmpty) return <EmptyState icon={icon} message={emptyMessage} hint={emptyHint} />
  return null
}
