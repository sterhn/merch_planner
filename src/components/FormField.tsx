import type { ReactNode } from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import { haptic } from '../lib/haptics'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 ml-1 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

const controlClass =
  'w-full rounded-control border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40'

export const inputClass = `h-12 ${controlClass}`
export const textareaClass = `min-h-24 py-3 ${controlClass}`

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const STYLE = {
  primary:
    'tap h-12 w-full rounded-full bg-linear-to-br from-brand to-brand-2 px-4 text-sm font-extrabold text-on-brand shadow-card hover:shadow-lift disabled:opacity-50 disabled:saturate-50',
  danger: 'tap h-12 w-full rounded-full px-4 text-sm font-bold text-bad hover:bg-bad/10 disabled:opacity-50',
  secondary:
    'tap flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-brand/40 px-4 text-sm font-bold text-brand hover:bg-brand/10 disabled:opacity-50',
  'secondary-good':
    'tap flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-good/50 px-4 text-sm font-bold text-good hover:bg-good/10 disabled:opacity-50',
  add: 'group tap flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-linear-to-br from-brand to-brand-2 px-4 text-sm font-extrabold text-on-brand shadow-card hover:shadow-lift disabled:opacity-50',
} as const

/**
 * Shared button body: fires a haptic before the caller's onClick, and merges any
 * `className` the caller passes rather than dropping it on the floor.
 */
function BaseButton({
  variant,
  pattern,
  children,
  onClick,
  className = '',
  ...props
}: ButtonProps & { variant: keyof typeof STYLE; pattern?: number | number[] }) {
  return (
    <button
      // Defaults to "button", before the spread so an explicit type still wins.
      // Most of these render inside an editor <form> — the delete and "Received"
      // actions among them — where a bare <button> would submit it instead.
      // Save buttons opt in with type="submit".
      type="button"
      {...props}
      onClick={(e) => {
        haptic(pattern)
        onClick?.(e)
      }}
      className={`${STYLE[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function PrimaryButton(props: ButtonProps) {
  return <BaseButton variant="primary" {...props} />
}

export function DangerButton(props: ButtonProps) {
  return <BaseButton variant="danger" pattern={[10, 30, 10]} {...props} />
}

/** Outlined counterpart to PrimaryButton, for secondary actions in a toolbar. */
export function SecondaryButton({ tone = 'brand', ...props }: ButtonProps & { tone?: 'brand' | 'good' }) {
  return <BaseButton variant={tone === 'good' ? 'secondary-good' : 'secondary'} {...props} />
}

/** The pill "Add …" action that opens each page's editor sheet. */
export function AddButton({ children, ...props }: ButtonProps) {
  return (
    <BaseButton variant="add" {...props}>
      <Plus size={16} strokeWidth={3} className="transition-transform duration-300 group-hover:rotate-90" />
      {children}
    </BaseButton>
  )
}

const ICON_TONE = {
  neutral: 'hover:bg-surface-2 hover:text-ink',
  danger: 'hover:bg-surface-2 hover:text-bad',
  good: 'hover:bg-surface-2 hover:text-good',
} as const

/**
 * Icon-only button. `label` is required — it's the accessible name, and these
 * have no visible text to fall back on.
 */
export function IconButton({
  icon: Icon,
  label,
  tone = 'neutral',
  size = 11,
  className = '',
  ...props
}: ButtonProps & {
  icon: LucideIcon
  label: string
  tone?: keyof typeof ICON_TONE
  /** Tailwind size step: 11 for toolbars (44px), 10 for inside list rows. */
  size?: 10 | 11
}) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={`tap grid ${size === 11 ? 'size-11' : 'size-10'} shrink-0 place-items-center rounded-full text-ink-faint disabled:opacity-40 ${ICON_TONE[tone]} ${className}`}
    >
      <Icon size={size === 11 ? 18 : 17} />
    </button>
  )
}
