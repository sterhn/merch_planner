import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const finishClose = useCallback(() => {
    if (!closingRef.current) return
    closingRef.current = false
    clearTimeout(closeTimer.current)
    setClosing(false)
    onCloseRef.current()
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    // Safety net in case animationend never fires
    closeTimer.current = setTimeout(finishClose, 400)
  }, [finishClose])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, requestClose])

  if (!open && !closing) return null

  return (
    <div
      className={`fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-t-sheet bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none md:max-w-lg md:rounded-sheet md:pb-5 ${
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
