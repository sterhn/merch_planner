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

/** Shows a toast for 5 s. An `action` (e.g. Undo) renders as a button on it. */
export function showToast(text: string, action?: ToastAction) {
  const id = ++nextId
  messages = [...messages, { id, text, action }]
  emit()
  setTimeout(() => dismissToast(id), 5000)
}

export function subscribeToasts(listener: (msgs: ToastMessage[]) => void): () => void {
  listeners.push(listener)
  listener(messages)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
