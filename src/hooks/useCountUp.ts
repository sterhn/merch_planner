import { useEffect, useRef, useState } from 'react'

const DURATION = 600

export function useCountUp(target: number) {
  const [value, setValue] = useState(target)
  const previous = useRef(target)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      previous.current = target
      return
    }
    if (target === previous.current) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 0 : DURATION
    const from = previous.current
    previous.current = target
    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}
