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
  messages = [...messages, { id, text, action }]
  // Over the limit, the oldest plain message goes first: an Undo may be the
  // only way back from what it reports.
  while (messages.length > MAX_VISIBLE) {
    const plain = messages.findIndex((m) => !m.action)
    messages = messages.filter((_, i) => i !== (plain === -1 ? 0 : plain))
  }
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
