import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { inputClass } from './FormField'
import { haptic } from '../lib/haptics'

/**
 * Row-list editor primitives shared by the Catalog bundle editor and the
 * Collects position editor — the two grew these controls independently and
 * they had already started to drift.
 */

/** Input-styled "tap to pick an item" button that opens a CatalogPicker modal. */
export function PickRowButton({
  label,
  empty,
  onClick,
}: {
  /** The picked item's name, or null when nothing is picked yet. */
  label: string | null
  /** Placeholder shown while nothing is picked. */
  empty: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onClick()
      }}
      className={`${inputClass} tap flex min-w-0 flex-1 items-center text-left`}
    >
      <span className={`truncate ${label ? '' : 'text-ink-faint'}`}>{label ?? empty}</span>
    </button>
  )
}

/** The "＋ Add …" action that appends a row beneath the list. */
export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onClick()
      }}
      className="tap flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand"
    >
      <Plus size={14} strokeWidth={3} />
      {children}
    </button>
  )
}
