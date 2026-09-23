import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
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
          className="pointer-events-auto flex max-w-sm animate-pop items-center gap-2 rounded-full bg-ink/90 py-3 pl-4 pr-5 text-sm font-semibold text-page shadow-lift backdrop-blur-sm"
        >
          <Sparkles size={16} className="shrink-0 text-sun" aria-hidden />
          {m.text}
        </div>
      ))}
    </div>
  )
}
