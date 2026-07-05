import type { ReactNode } from 'react'
import { haptic } from '../lib/haptics'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

const controlClass =
  'w-full rounded-control border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40'

export const inputClass = `h-12 ${controlClass}`
export const textareaClass = `min-h-24 py-3 ${controlClass}`

export function PrimaryButton({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onClick={(e) => {
        haptic()
        onClick?.(e)
      }}
      className="tap h-12 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-card disabled:opacity-50 disabled:saturate-50"
    >
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onClick={(e) => {
        haptic([10, 30, 10])
        onClick?.(e)
      }}
      className="tap h-12 w-full rounded-full px-4 text-sm font-bold text-bad hover:bg-bad/10 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
