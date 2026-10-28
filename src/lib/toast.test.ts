import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, showToast, subscribeToasts, type ToastMessage } from './toast'

describe('showToast', () => {
  let seen: ToastMessage[] = []
  const unsubscribe = subscribeToasts((m) => (seen = m))

  afterEach(() => {
    for (const m of seen) dismissToast(m.id)
    vi.useRealTimers()
  })

  it('keeps an Undo on screen when a burst of plain messages arrives', () => {
    showToast('Removed X', { label: 'Undo', onClick: () => {} })
    showToast('Saved 1')
    showToast('Saved 2')
    showToast('Saved 3')
    expect(seen.map((m) => m.text)).toEqual(['Removed X', 'Saved 2', 'Saved 3'])
  })

  it('gives action toasts longer before they go', () => {
    vi.useFakeTimers()
    showToast('plain')
    showToast('undoable', { label: 'Undo', onClick: () => {} })
    vi.advanceTimersByTime(5000)
    expect(seen.map((m) => m.text)).toEqual(['undoable'])
    vi.advanceTimersByTime(3000)
    expect(seen).toEqual([])
    unsubscribe()
  })
})
