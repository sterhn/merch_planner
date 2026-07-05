import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastMessage } from '../lib/toast'

export default function Toast() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
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
