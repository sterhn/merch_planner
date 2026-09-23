import { Sparkle, type LucideIcon } from 'lucide-react'
import LoadingDots from './LoadingDots'
import { TONE_BLOB, type Tone } from './tones'

export default function EmptyState({
  icon: Icon,
  message,
  hint,
  spin,
  tone = 'brand',
  onRetry,
}: {
  icon?: LucideIcon
  message: string
  hint?: string
  /** Renders the loading indicator instead of the icon. */
  spin?: boolean
  tone?: Tone
  onRetry?: () => void
}) {
  if (spin) return <LoadingDots label={message} />
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {Icon && (
        <div className="relative mb-1">
          <div className={`grid size-20 animate-float place-items-center rounded-[42%] ${TONE_BLOB[tone]}`}>
            <Icon size={34} strokeWidth={1.9} />
          </div>
          <Sparkle
            size={14}
            className="absolute -right-2 -top-1 animate-twinkle fill-current text-sun"
            aria-hidden
          />
          <Sparkle
            size={10}
            className="absolute -left-2 bottom-1 animate-twinkle fill-current text-accent"
            style={{ animationDelay: '0.8s' }}
            aria-hidden
          />
        </div>
      )}
      <p className="font-display text-base text-ink-muted">{message}</p>
      {hint && <p className="max-w-64 text-xs text-ink-faint">{hint}</p>}
      {onRetry && (
        <button onClick={onRetry} className="tap min-h-11 rounded-full px-4 text-sm font-bold text-brand hover:bg-brand/10">
          Try again
        </button>
      )}
    </div>
  )
}
