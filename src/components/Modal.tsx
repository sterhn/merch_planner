import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

// Open modals, bottom to top. Sheets can stack (a confirm sheet over an editor),
// and only the topmost one may react to Escape or trap Tab — otherwise one key
// press would close every layer at once.
const modalStack: symbol[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Pulled down this far (px), or flicked faster than DISMISS_SPEED, the sheet closes. */
const DISMISS_DISTANCE = 110
const DISMISS_SPEED = 0.6

export default function Modal({ title, open, onClose, children }: ModalProps) {
  const [closing, setClosing] = useState(false)
  // How far the sheet is being dragged down by its grab area (touch only).
  const [drag, setDrag] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ y: 0, t: 0 })
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
    setDrag(null)
    setDragging(false)
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
    // Unless a field inside already took focus (autoFocus), focus the sheet.
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) panel.focus()
    const token = Symbol('modal')
    modalStack.push(token)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (modalStack[modalStack.length - 1] !== token) return
      if (e.key === 'Escape') {
        requestClose()
        return
      }
      // Keep Tab inside the sheet: aria-modal promises the page behind is
      // unreachable, so wrap at the edges instead of tabbing out into it.
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusables.length === 0) {
          e.preventDefault()
          panel.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        const inside = active instanceof HTMLElement && panel.contains(active)
        if (e.shiftKey) {
          if (!inside || active === first) {
            e.preventDefault()
            last.focus()
          }
        } else if (!inside || active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      const i = modalStack.indexOf(token)
      if (i !== -1) modalStack.splice(i, 1)
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, requestClose])

  if (!open && !closing) return null

  // Drag the handle / title row down to dismiss, like a native sheet. The
  // closing animation has only an end keyframe, so it carries on from wherever
  // the finger let go.
  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || closingRef.current) return
      if ((e.target as HTMLElement).closest('button')) return
      dragStart.current = { y: e.clientY, t: performance.now() }
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
      setDrag(0)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!dragging) return
      const dy = e.clientY - dragStart.current.y
      // Resist pulling up past the resting point.
      setDrag(dy > 0 ? dy : dy / 6)
    },
    onPointerUp: () => {
      if (!dragging || drag === null) return
      setDragging(false)
      const speed = drag / Math.max(1, performance.now() - dragStart.current.t)
      if (drag > DISMISS_DISTANCE || (drag > 24 && speed > DISMISS_SPEED)) requestClose()
      // Not far enough: glide back into place.
      else setDrag(0)
    },
    onPointerCancel: () => {
      setDragging(false)
      setDrag(0)
    },
  }

  return (
    <div
      className={`fixed inset-0 z-30 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center ${
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
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-t-sheet bg-surface p-5 shadow-[inset_0_1px_0_var(--glass-rim)] pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none md:max-w-lg md:rounded-sheet md:pb-5 ${
          closing ? 'animate-sheet-down md:animate-fade-out' : 'animate-sheet-up md:animate-pop'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={
          drag !== null
            ? {
                transform: `translateY(${drag}px)`,
                transition: dragging || closing ? 'none' : 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
              }
            : undefined
        }
        onAnimationEnd={() => {
          if (closingRef.current) finishClose()
        }}
      >
        {/* Grab area: the handle and title row. touch-none so the drag isn't
            taken for a scroll of the sheet's content. */}
        <div {...dragHandlers} className="-mx-5 -mt-5 touch-none px-5 pt-5 md:touch-auto">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg">{title}</h2>
            <button
              onClick={requestClose}
              className="tap flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-muted hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
