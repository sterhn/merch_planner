import { useEffect, useRef } from 'react'

/**
 * Placed after a revealed list: loads the next rows as it nears the viewport.
 * Doubles as a visible button, so keyboard and screen-reader users (and any
 * browser without IntersectionObserver) can still reach the rest.
 */
export default function RevealMore({ onReveal, remaining }: { onReveal: () => void; remaining: number }) {
  const ref = useRef<HTMLButtonElement>(null)

  // Re-observed after every reveal: an observer only reports changes, so if
  // the sentinel is still on screen after a batch, a fresh one fires again.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onReveal()
    }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [onReveal, remaining])

  return (
    <button
      ref={ref}
      type="button"
      onClick={onReveal}
      className="tap glass mt-2 min-h-11 w-full rounded-full text-sm font-bold text-brand"
    >
      Show more ({remaining})
    </button>
  )
}
