import { useMemo } from 'react'
import { Copy, Send } from 'lucide-react'
import type { Order, OrderItem } from '../../lib/types'
import { customerMessages, telegramLink } from '../../lib/customerMessages'
import { showToast } from '../../lib/toast'
import { haptic } from '../../lib/haptics'
import Modal from '../../components/Modal'
import { SecondaryButton } from '../../components/FormField'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Ready-made messages for the customer, one tap to copy (and open their Telegram chat). */
export default function MessagesSheet({
  open,
  onClose,
  order,
  lines,
  catalog,
}: {
  open: boolean
  onClose: () => void
  order: Order
  lines: OrderItem[]
  catalog: ReadonlyMap<string, { name: string }>
}) {
  // The one that fits the order's status goes first — it's usually the one you want.
  const messages = useMemo(
    () =>
      customerMessages(order, lines, catalog).sort((a, b) => Number(b.suggested) - Number(a.suggested)),
    [order, lines, catalog],
  )
  const chat = telegramLink(order.telegram)

  return (
    <Modal title="Message to customer" open={open} onClose={onClose}>
      <div className="space-y-3">
        {messages.map((m) => (
          <section
            key={m.key}
            className={`rounded-control border p-3 ${m.suggested ? 'border-brand/50 bg-brand/5' : 'border-line'}`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-sm font-bold">{m.title}</h3>
              {m.suggested && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-2xs font-bold text-on-brand">fits now</span>
              )}
            </div>
            <p className="mb-2 whitespace-pre-wrap rounded-control bg-surface-2 px-3 py-2 text-sm">{m.text}</p>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                onClick={() =>
                  void copy(m.text).then((ok) => showToast(ok ? 'Copied — paste it in the chat' : 'Could not copy'))
                }
              >
                <Copy size={15} />
                Copy
              </SecondaryButton>
              {chat && (
                // A real link (not window.open after the copy) so iOS doesn't
                // treat the new tab as a popup; the copy starts in the same tap.
                <a
                  href={chat}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    haptic()
                    void copy(m.text)
                  }}
                  className="tap flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-brand/40 px-4 text-sm font-bold text-brand hover:bg-brand/10"
                >
                  <Send size={15} />
                  Copy &amp; open Telegram
                </a>
              )}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
