import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TONE_BLOB, type Tone } from './tones'

/**
 * The title row every page opens with. Keeps the display size consistent —
 * before this, two pages had drifted to text-xl. Pass the section's `icon` and
 * `tone` (see sections.ts) so the header matches its nav tab.
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  tone = 'brand',
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  children?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span
            className={`group grid size-11 shrink-0 place-items-center rounded-[38%] ${TONE_BLOB[tone]}`}
            aria-hidden
          >
            <Icon size={22} strokeWidth={2.2} className="group-hover:animate-wiggle" />
          </span>
        )}
        <div className="min-w-0">
          {typeof title === 'string' ? <h1 className="truncate font-display text-2xl leading-tight">{title}</h1> : title}
          {subtitle && <p className="truncate text-xs font-semibold text-ink-faint">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </div>
  )
}
