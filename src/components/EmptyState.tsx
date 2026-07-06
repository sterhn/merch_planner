import type { LucideIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon,
  message,
  hint,
  spin,
  onRetry,
}: {
  icon?: LucideIcon
  message: string
  hint?: string
  spin?: boolean
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {Icon && (
        <div className="flex size-16 items-center justify-center rounded-full bg-brand/10">
          <Icon size={28} className={`text-brand ${spin ? 'animate-spin' : ''}`} />
        </div>
      )}
      <p className="text-sm font-semibold text-ink-muted">{message}</p>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      {onRetry && (
        <button onClick={onRetry} className="tap min-h-11 rounded-full px-4 text-sm font-bold text-brand hover:bg-brand/10">
          Retry
        </button>
      )}
    </div>
  )
}
