export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastMessage {
  id: number
  text: string
  action?: ToastAction
}

let nextId = 0
let messages: ToastMessage[] = []
let listeners: ((msgs: ToastMessage[]) => void)[] = []

function emit() {
  for (const listener of listeners) listener(messages)
}

export function dismissToast(id: number) {
  messages = messages.filter((m) => m.id !== id)
  emit()
}

/** At most this many on screen; a burst of saves shouldn't stack up a tower. */
const MAX_VISIBLE = 3

/**
 * Shows a toast for 5 s — 8 s when it carries an `action` (e.g. Undo), which
 * renders as a button on it and needs time to be read and reached.
 */
export function showToast(text: string, action?: ToastAction) {
  const id = ++nextId
  messages = [...messages, { id, text, action }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => dismissToast(id), action ? 8000 : 5000)
}

export function subscribeToasts(listener: (msgs: ToastMessage[]) => void): () => void {
  listeners.push(listener)
  listener(messages)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
