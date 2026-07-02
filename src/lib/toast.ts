export interface ToastMessage {
  id: number
  text: string
}

let nextId = 0
let messages: ToastMessage[] = []
let listeners: ((msgs: ToastMessage[]) => void)[] = []

function emit() {
  for (const listener of listeners) listener(messages)
}

export function showToast(text: string) {
  const id = ++nextId
  messages = [...messages, { id, text }]
  emit()
  setTimeout(() => {
    messages = messages.filter((m) => m.id !== id)
    emit()
  }, 5000)
}

export function subscribeToasts(listener: (msgs: ToastMessage[]) => void): () => void {
  listeners.push(listener)
  listener(messages)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
