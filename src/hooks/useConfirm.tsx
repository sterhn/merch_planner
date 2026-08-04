import { useCallback, useState, type ReactNode } from 'react'
import ConfirmSheet from '../components/ConfirmSheet'

/**
 * `confirm('Delete this?', doDelete)` opens a themed confirm sheet; the action
 * only runs on the confirm tap. Render `element` once somewhere in the page.
 */
export function useConfirm(): {
  confirm: (message: string, onConfirm: () => void) => void
  element: ReactNode
} {
  const [request, setRequest] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const confirm = useCallback(
    (message: string, onConfirm: () => void) => setRequest({ message, onConfirm }),
    [],
  )
  return {
    confirm,
    element: (
      <ConfirmSheet
        open={request !== null}
        message={request?.message ?? ''}
        onCancel={() => setRequest(null)}
        onConfirm={() => {
          request?.onConfirm()
          setRequest(null)
        }}
      />
    ),
  }
}
