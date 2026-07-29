import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastMessage } from '../lib/toast'

export default function Toast() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null
  return (
    // bottom-nav clears the mobile tab bar; both derive from --spacing-nav.
    <div className="pointer-events-none fixed inset-x-0 bottom-nav z-50 mb-6 flex flex-col items-center gap-2 px-4 md:mb-0 md:bottom-6">
      {items.map((m) => (
        <div
          key={m.id}
          className="pointer-events-auto max-w-sm animate-pop rounded-full bg-ink/90 px-5 py-3 text-sm font-semibold text-page shadow-card backdrop-blur-sm"
        >
          {m.text}
        </div>
      ))}
    </div>
  )
}
