import { useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { haptic } from '../lib/haptics'

export type SwipeTone = 'good' | 'bad' | 'accent' | 'brand'

export interface SwipeAction {
  icon: LucideIcon
  label: string
  /** Fill of the revealed area. The matching foreground is chosen here, not by
      the caller — the fills invert in dark mode and white would drop to ~1.8:1. */
  tone: SwipeTone
  onAction: () => void
}

const TONE_CLASS: Record<SwipeTone, string> = {
  good: 'bg-good text-on-good',
  bad: 'bg-bad text-on-bad',
  accent: 'bg-accent text-on-accent',
  brand: 'bg-brand text-on-brand',
}

const MAX_PULL = 96
const THRESHOLD = 64
const LOCK_DISTANCE = 10
const CLICK_SUPPRESS = 8

/**
 * Wraps a list row with horizontal swipe gestures.
 * `left` is revealed by swiping right; `right` is revealed by swiping left.
 * Vertical scrolling is preserved via axis locking + touch-action: pan-y.
 */
export default function SwipeableRow({
  left,
  right,
  children,
}: {
  left?: SwipeAction
  right?: SwipeAction
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef({ x: 0, y: 0 })
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const crossed = useRef(false)
  const suppressClick = useRef(false)

  const rubberBand = (delta: number) => {
    const capped = Math.sign(delta) * Math.min(Math.abs(delta), MAX_PULL)
    return Math.abs(delta) > MAX_PULL ? capped + (delta - capped) * 0.15 : capped
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = 'none'
    crossed.current = false
    suppressClick.current = false
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const deltaX = e.clientX - start.current.x
    const deltaY = e.clientY - start.current.y

    if (axis.current === 'none') {
      if (Math.abs(deltaY) > LOCK_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX)) {
        axis.current = 'y'
        setDragging(false)
        return
      }
      if (Math.abs(deltaX) > LOCK_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY)) {
        axis.current = 'x'
        e.currentTarget.setPointerCapture(e.pointerId)
      } else {
        return
      }
    }
    if (axis.current !== 'x') return

    let next = deltaX
    if (next > 0 && !left) next = 0
    if (next < 0 && !right) next = 0
    if (Math.abs(deltaX) > CLICK_SUPPRESS) suppressClick.current = true

    const pastThreshold = Math.abs(next) >= THRESHOLD
    if (pastThreshold && !crossed.current) {
      crossed.current = true
      haptic()
    } else if (!pastThreshold) {
      crossed.current = false
    }
    setDx(rubberBand(next))
  }

  function onPointerEnd() {
    if (!dragging && axis.current !== 'x') return
    setDragging(false)
    if (axis.current === 'x' && crossed.current) {
      const action = dx > 0 ? left : right
      action?.onAction()
    }
    axis.current = 'none'
    crossed.current = false
    setDx(0)
  }

  const active = dx > 0 ? left : dx < 0 ? right : undefined
  const Icon = active?.icon

  return (
    <div className="relative overflow-hidden rounded-card" style={{ touchAction: 'pan-y' }}>
      {active && Icon && (
        <div
          className={`absolute inset-0 flex items-center ${TONE_CLASS[active.tone]} ${
            dx > 0 ? 'justify-start pl-5' : 'justify-end pr-5'
          }`}
        >
          <span className="flex flex-col items-center gap-0.5">
            <Icon size={20} />
            <span className="text-[10px] font-bold">{active.label}</span>
          </span>
        </div>
      )}
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault()
            e.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
