import Modal from './Modal'
import { DangerButton, PrimaryButton, SecondaryButton } from './FormField'

/**
 * Themed replacement for window.confirm: the question as a bottom sheet,
 * matching the rest of the app instead of the OS dialog. Stacks fine on top of
 * an open editor sheet. Destructive by default ("Delete"); pass `tone="primary"`
 * and a label for a confirm that isn't a deletion. Most pages want the
 * `useConfirm` hook rather than rendering this directly.
 */
export default function ConfirmSheet({
  open,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  const ConfirmButton = tone === 'primary' ? PrimaryButton : DangerButton
  return (
    <Modal title={message} open={open} onClose={onCancel}>
      <ConfirmButton onClick={onConfirm}>{confirmLabel}</ConfirmButton>
      <div className="mt-2">
        <SecondaryButton onClick={onCancel} className="w-full">
          Cancel
        </SecondaryButton>
      </div>
    </Modal>
  )
}
