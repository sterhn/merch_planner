import { useEffect } from 'react'

/** True while focus is somewhere that takes typing. */
function typingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Desktop shortcuts, for when the app is open on a laptop:
 * `/` jumps to the page's search box, `n` opens the page's "add" sheet (the
 * button marked `data-shortcut="new"`). Ignored while typing or with a sheet open.
 */
export function useShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (typingInto(e.target) || document.querySelector('[aria-modal="true"]')) return
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('main input[type="search"]')
        if (!search) return
        e.preventDefault()
        search.focus()
        search.select()
      } else if (e.key === 'n' || e.key === 'N') {
        const add = document.querySelector<HTMLButtonElement>('main [data-shortcut="new"]')
        if (!add) return
        e.preventDefault()
        add.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
