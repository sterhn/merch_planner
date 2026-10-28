import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Scroll offset per history entry, for this session. Keyed by location.key so
// two visits to the same page each come back to their own spot.
const positions = new Map<string, number>()

/** Gives up waiting for a page to grow tall enough to restore into. */
const RESTORE_TIMEOUT_MS = 1500

/**
 * Browser-style scrolling for the HashRouter, which has none of its own:
 * a new page opens at the top, Back returns to where you were. Before this, a
 * tab opened at whatever offset the previous page had been scrolled to.
 * Filter changes (replace navigations) keep the offset.
 */
export default function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Remember the offset of the entry being viewed. The key lives in a ref that
  // the layout effect below switches *before* it scrolls, so the reset to the
  // top on a new page is never recorded against the page being left.
  const currentKey = useRef(location.key)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        positions.set(currentKey.current, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // A layout effect, so it runs before the pages' own passive effects — the
  // Orders list restores its remembered offset after this reset.
  useLayoutEffect(() => {
    currentKey.current = location.key
    if (navType === 'PUSH') {
      window.scrollTo(0, 0)
      return
    }
    if (navType !== 'POP') return
    const target = positions.get(location.key)
    if (!target) return
    // The page may still be loading (a lazy chunk, a query, a list revealed in
    // steps), so keep trying each frame until it's tall enough — unless the
    // user starts scrolling first.
    const started = performance.now()
    let frame = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
    }
    const attempt = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) < 2 || performance.now() - started > RESTORE_TIMEOUT_MS) return stop()
      frame = requestAnimationFrame(attempt)
    }
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    attempt()
    return stop
  }, [location.key, navType])

  return null
}
