import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500'

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-700 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
