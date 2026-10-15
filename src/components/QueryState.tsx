import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import EmptyState from './EmptyState'
import LoadingDots from './LoadingDots'
import type { Tone } from './tones'

/**
 * The loading / error / empty triad every list page renders above its rows.
 * Returns null once there is data to show.
 */
export default function QueryState({
  isLoading,
  isError,
  isEmpty,
  icon,
  tone,
  errorMessage,
  emptyMessage,
  emptyHint,
  onRetry,
  skeleton,
}: {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  icon: LucideIcon
  tone?: Tone
  errorMessage: string
  emptyMessage: string
  emptyHint?: string
  onRetry?: () => void
  /** Shown while loading instead of the dots — a Skeleton shaped like the list. */
  skeleton?: ReactNode
}) {
  if (isLoading) return skeleton ?? <LoadingDots />
  if (isError) return <EmptyState icon={icon} tone="bad" message={errorMessage} onRetry={onRetry} />
  if (isEmpty) return <EmptyState icon={icon} tone={tone} message={emptyMessage} hint={emptyHint} />
  return null
}
