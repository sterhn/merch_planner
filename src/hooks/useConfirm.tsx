import { useCallback, useState, type ReactNode } from 'react'
import ConfirmSheet from '../components/ConfirmSheet'

interface ConfirmOptions {
  /** Confirm button text; defaults to "Delete". */
  label?: string
  /** 'primary' for a confirm that isn't destructive. */
  tone?: 'danger' | 'primary'
}

/**
 * `confirm('Delete this?', doDelete)` opens a themed confirm sheet; the action
 * only runs on the confirm tap. Render `element` once somewhere in the page.
 * For anything that isn't a delete, pass `{ label, tone: 'primary' }`.
 */
export function useConfirm(): {
  confirm: (message: string, onConfirm: () => void, options?: ConfirmOptions) => void
  element: ReactNode
} {
  const [request, setRequest] = useState<({ message: string; onConfirm: () => void } & ConfirmOptions) | null>(null)
  const confirm = useCallback(
    (message: string, onConfirm: () => void, options: ConfirmOptions = {}) =>
      setRequest({ message, onConfirm, ...options }),
    [],
  )
  return {
    confirm,
    element: (
      <ConfirmSheet
        open={request !== null}
        message={request?.message ?? ''}
        confirmLabel={request?.label}
        tone={request?.tone}
        onCancel={() => setRequest(null)}
        onConfirm={() => {
          request?.onConfirm()
          setRequest(null)
        }}
      />
    ),
  }
}
