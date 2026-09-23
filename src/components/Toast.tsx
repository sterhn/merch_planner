import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { dismissToast, subscribeToasts, type ToastMessage } from '../lib/toast'
import { haptic } from '../lib/haptics'

export default function Toast() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null
  return (
    // Clears the floating mobile tab bar: its height (--spacing-nav) plus the
    // safe area and the 0.5rem it floats above it (see Layout).
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1.25rem)] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((m) => (
        <div
          key={m.id}
          role="status"
          className={`pointer-events-auto flex max-w-sm animate-pop items-center gap-2 rounded-full bg-ink/85 py-3 pl-4 text-sm font-semibold text-page shadow-lift backdrop-blur-md ${
            m.action ? 'pr-1.5' : 'pr-5'
          }`}
        >
          <Sparkles size={16} className="shrink-0 text-sun" aria-hidden />
          {m.text}
          {m.action && (
            <button
              type="button"
              onClick={() => {
                haptic()
                m.action!.onClick()
                dismissToast(m.id)
              }}
              className="tap -my-2 ml-1 min-h-11 rounded-full px-4 font-bold text-sun hover:bg-page/10"
            >
              {m.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
