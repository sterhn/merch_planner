import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastMessage } from '../lib/toast'

export default function Toast() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((m) => (
        <div key={m.id} className="pointer-events-auto max-w-sm rounded-lg bg-gray-900/90 px-4 py-2.5 text-sm text-white shadow-lg">
          {m.text}
        </div>
      ))}
    </div>
  )
}
