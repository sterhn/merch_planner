import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  if (!open && !closing) return null

  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    // Safety net in case animationend never fires
    closeTimer.current = setTimeout(finishClose, 400)
  }

  const finishClose = () => {
    if (!closingRef.current) return
    closingRef.current = false
    clearTimeout(closeTimer.current)
    setClosing(false)
    onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={requestClose}
    >
      <div
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-t-sheet bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-w-lg md:rounded-sheet md:pb-5 ${
          closing ? 'animate-sheet-down md:animate-fade-out' : 'animate-sheet-up md:animate-pop'
        }`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => {
          if (closingRef.current) finishClose()
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button
            onClick={requestClose}
            className="tap flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-faint hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
