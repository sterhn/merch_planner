import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
