// Ready-to-send Russian messages for a customer, built from the order. The
// wording avoids gendered past-tense verbs ("получила/получил") so it reads
// right whoever sends it.

import type { Order, OrderItem } from './types'
import { formatRub } from './format'
import { linesTotal, sortLinesByPrice } from './orderLines'

export interface CustomerMessage {
  key: 'summary' | 'reminder' | 'paid' | 'sent' | 'thanks'
  title: string
  text: string
  /** The one that fits the order's current status. */
  suggested: boolean
}

type MessageOrder = Pick<
  Order,
  'total_price' | 'paid' | 'sent' | 'delivered' | 'delivery_method' | 'shipping_fee' | 'discount'
>

/** How each delivery method reads inside "Ваш заказ отправлен …". */
const SENT_VIA: Record<string, string> = {
  'почта': 'Почтой России',
  'сдэк': 'через СДЭК',
  'яндекс': 'Яндекс Доставкой',
  'озон': 'через Ozon',
}

const PICKUP_CITY: Record<string, string> = {
  'самовывоз мск': 'в Москве',
  'самовывоз спб': 'в Санкт-Петербурге',
}

function lineName(line: OrderItem, catalog: ReadonlyMap<string, { name: string }>): string {
  return (line.item_id ? catalog.get(line.item_id)?.name : null) ?? line.name_text ?? 'товар'
}

export function customerMessages(
  order: MessageOrder,
  lines: OrderItem[],
  catalog: ReadonlyMap<string, { name: string }>,
): CustomerMessage[] {
  const total = order.total_price ?? linesTotal(lines) + (order.shipping_fee ?? 0) - (order.discount ?? 0)

  const itemLines = sortLinesByPrice(lines).map((l) => {
    const qty = l.qty > 1 ? ` ×${l.qty}` : ''
    const price = l.unit_price != null ? ` — ${formatRub(l.unit_price * l.qty)}` : ''
    return `• ${lineName(l, catalog)}${qty}${price}`
  })
  const summary = [
    'Здравствуйте! Ваш заказ:',
    ...itemLines,
    ...(order.shipping_fee ? [`Доставка — ${formatRub(order.shipping_fee)}`] : []),
    ...(order.discount ? [`Скидка — −${formatRub(order.discount)}`] : []),
    `Итого: ${formatRub(total)}`,
  ].join('\n')

  const method = order.delivery_method ?? ''
  const pickupCity = PICKUP_CITY[method]
  const sent = pickupCity
    ? `Ваш заказ собран и ждёт самовывоза ${pickupCity}! Напишите, когда будет удобно забрать.`
    : `Ваш заказ отправлен${SENT_VIA[method] ? ` ${SENT_VIA[method]}` : ''}! 📦\nТрек-номер: `

  // Which one fits right now: payment, then dispatch, then the follow-up.
  const current: CustomerMessage['key'] = !order.paid
    ? 'reminder'
    : !order.sent
      ? 'paid'
      : !order.delivered
        ? 'sent'
        : 'thanks'

  const messages: Omit<CustomerMessage, 'suggested'>[] = [
    { key: 'summary', title: 'Order summary', text: summary },
    {
      key: 'reminder',
      title: 'Payment reminder',
      text: `Здравствуйте! Напоминаю про ваш заказ на ${formatRub(total)} — он ждёт оплаты. Если остались вопросы, пишите 🙂`,
    },
    { key: 'paid', title: 'Payment received', text: 'Спасибо, оплата получена! Соберу заказ и сообщу, когда отправлю 💜' },
    { key: 'sent', title: pickupCity ? 'Ready for pickup' : 'Order sent', text: sent },
    { key: 'thanks', title: 'Thank you', text: 'Спасибо за заказ! Если всё понравилось, отзыв очень поможет 💜' },
  ]
  return messages.map((m) => ({ ...m, suggested: m.key === current }))
}

/**
 * A t.me link for the order's Telegram contact, or null when it isn't a
 * usable username. Accepts "@name", "name" and t.me links.
 */
export function telegramLink(contact: string | null | undefined): string | null {
  const raw = (contact ?? '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(raw) ? `https://t.me/${raw}` : null
}
