import Modal from './Modal'
import { DangerButton, SecondaryButton } from './FormField'

/**
 * Themed replacement for window.confirm: the destructive question as a bottom
 * sheet, matching the rest of the app instead of the OS dialog. Stacks fine on
 * top of an open editor sheet. Most pages want the `useConfirm` hook rather
 * than rendering this directly.
 */
export default function ConfirmSheet({
  open,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={message} open={open} onClose={onCancel}>
      <DangerButton onClick={onConfirm}>{confirmLabel}</DangerButton>
      <div className="mt-2">
        <SecondaryButton onClick={onCancel} className="w-full">
          Cancel
        </SecondaryButton>
      </div>
    </Modal>
  )
}
