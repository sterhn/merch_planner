import type { Order, OrderItem } from './types'
import { formatDate, formatRub } from './format'
import { linesTotal, NO_FANDOM_LABEL, sortLinesByPrice, type FandomGroup } from './orderLines'
import { generateQrSvg } from './qrCode'

/** Name lookup shared by both printouts — the catalog map, trimmed to what's used. */
export type PrintCatalog = ReadonlyMap<string, { name: string }>

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escapes a value for interpolation into the printout. Item names, comments and
 * delivery details are user-entered, and an `&` or `<` in one of them would
 * otherwise corrupt the rest of the document.
 */
export function esc(value: string | null | undefined): string {
  if (value == null) return ''
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/** The paid / sent / delivered line both printouts carry. */
export function statusParts(order: Pick<Order, 'paid' | 'sent' | 'delivered'>): string[] {
  return [
    order.paid ? '✓ Paid' : '✗ Not paid',
    order.sent ? '✓ Sent' : '✗ Not sent',
    order.delivered ? '✓ Delivered' : '✗ Not delivered',
  ]
}

/** Header row for the four-column item table. */
export const ITEM_TABLE_HEAD = `<tr>
    <th>Item</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Price</th>
    <th style="text-align:right">Subtotal</th>
  </tr>`

function itemRow(line: OrderItem, catalog: PrintCatalog): string {
  const name = (line.item_id ? catalog.get(line.item_id)?.name : null) ?? line.name_text ?? '—'
  const price = line.unit_price ?? 0
  return `<tr>
    <td>${esc(name)}</td>
    <td style="text-align:center">${line.qty}</td>
    <td style="text-align:right">${formatRub(price)}</td>
    <td style="text-align:right">${formatRub(price * line.qty)}</td>
  </tr>`
}

/**
 * The table body. Pass `groups` to print fandom headings, or null for a flat
 * list — `lines` should already be in the order it should print in.
 */
export function itemRowsHtml(
  lines: OrderItem[],
  catalog: PrintCatalog,
  groups: FandomGroup[] | null = null,
): string {
  const rows = (ls: OrderItem[]) => ls.map((l) => itemRow(l, catalog)).join('')
  if (groups) {
    return groups
      .map(
        (g) =>
          `<tr class="group"><td colspan="4">${esc(g.fandom ?? NO_FANDOM_LABEL)}</td></tr>${rows(g.lines)}`,
      )
      .join('')
  }
  return rows(lines)
}

/**
 * Print stylesheets for both printouts, side by side so they stop drifting
 * apart — they used to live inline in two pages and diverged on every edit.
 * The single-order sheet is the roomier one; the list sheet trades size for
 * fitting many orders per page.
 */
export const SINGLE_ORDER_CSS = `
    body { font-family: sans-serif; font-size: 13px; padding: 28px 32px; color: #111; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .date { color: #666; margin-bottom: 12px; font-size: 12px; }
    .status { display: flex; gap: 20px; margin-bottom: 16px; font-size: 12px; color: #444; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 5px 6px 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    th:not(:first-child) { text-align: right; }
    td { padding: 5px 6px 5px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    tr.group td { padding-top: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1px solid #bbb; }
    .items-total { text-align: right; font-size: 12px; color: #555; margin-bottom: 4px; }
    .order-total { text-align: right; font-weight: bold; font-size: 15px; margin-bottom: 16px; }
    .info { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
    .info p { margin: 3px 0; font-size: 12px; }
`

export const ORDER_LIST_CSS = `
    body { font-family: sans-serif; font-size: 12px; padding: 20px 28px; color: #111; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 14px; color: #555; margin: 0 0 20px; font-weight: normal; }
    .order { border-top: 2px solid #333; padding-top: 10px; margin-bottom: 18px; page-break-inside: avoid; }
    .order-header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 3px; }
    h2 { font-size: 14px; margin: 0; }
    .badge { background: #eee; border-radius: 4px; padding: 1px 6px; font-size: 10px; }
    .status { font-size: 10px; color: #666; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #444; margin-top: 1px; }
    .comment { color: #888; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 3px; }
    th { text-align: left; border-bottom: 1px solid #333; padding: 3px 6px 3px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 3px 6px 3px 0; border-bottom: 1px solid #eee; font-size: 11px; }
    tr.group td { padding-top: 7px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1px solid #ccc; }
    .items-total { text-align: right; font-size: 10px; color: #666; }
    .order-total { text-align: right; font-weight: bold; font-size: 13px; margin-top: 2px; }
    .no-items { color: #aaa; font-size: 11px; margin: 4px 0; }
`

/** The full print document. `title` is escaped here; `body` is already HTML. */
export function printPageHtml(title: string, css: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`
}

// ── Receipt ─────────────────────────────────────────────────────────
// Branded packing-slip receipt. Change these constants to match your shop.

export const SHOP_NAME = 'Your Shop'
export const SHOP_TAGLINE = 'handmade merch & prints'
export const SHOP_TELEGRAM = 'https://t.me/hehearse_exe'
export const SHOP_EST_YEAR = '2024'

export const RECEIPT_CSS = `
  @page { margin: 20mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: sans-serif; font-size: 13px; color: #111; display: flex; justify-content: center; }
  .receipt {
    width: 380px; border: 1.5px solid #222;
    padding: 32px 30px 24px; position: relative;
  }
  .receipt::before {
    content: ''; position: absolute; inset: 5px;
    border: 0.75px solid #ccc; pointer-events: none;
  }
  .stamp { text-align: center; margin-bottom: 18px; }
  .stamp svg { display: inline-block; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #666; }
  .orn { display: flex; align-items: center; margin: 10px 0; color: #bbb; font-size: 8px; }
  .orn::before, .orn::after { content: ''; flex: 1; border-top: 1px solid #ddd; }
  .orn span { padding: 0 10px; }
  .items { list-style: none; }
  .item { display: flex; align-items: baseline; font-size: 12px; margin-bottom: 5px; gap: 5px; }
  .item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .item-dots { flex: 1; min-width: 14px; border-bottom: 1px dotted #ccc; margin-bottom: 3px; }
  .item-price { white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; }
  .item-qty { font-size: 10px; color: #666; margin-bottom: 6px; padding-left: 8px; }
  .summary { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.04em; }
  .total { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; font-weight: 700; margin-top: 4px; }
  .total .label { text-transform: uppercase; letter-spacing: 0.05em; font-size: 13px; }
  .total .amount { font-variant-numeric: tabular-nums; }
  .delivery { font-size: 10px; color: #444; margin: 2px 0; }
  .badge { display: inline-block; font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; background: #eee; color: #111; margin-top: 3px; }
  .thanks { text-align: center; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 13px; color: #444; margin: 14px 0 2px; }
  .stars { text-align: center; font-size: 8px; color: #bbb; letter-spacing: 0.3em; margin-bottom: 12px; }
  .qr { display: flex; flex-direction: column; align-items: center; gap: 5px; margin-bottom: 4px; }
  .qr svg { display: block; fill: #111; }
  .qr-link { font-size: 9px; color: #888; letter-spacing: 0.03em; }
  .receipt-id { text-align: center; font-size: 8px; color: #bbb; margin-top: 10px; letter-spacing: 0.03em; }
  .bottom-orn { text-align: center; font-size: 8px; color: #ccc; letter-spacing: 0.4em; margin-top: 14px; }
`

function stampSvg(): string {
  const dots: string[] = []
  for (let i = 0; i < 20; i++) {
    const a = (2 * Math.PI * i) / 20 - Math.PI / 2
    dots.push(`<circle cx="${(60 + 47 * Math.cos(a)).toFixed(1)}" cy="${(60 + 47 * Math.sin(a)).toFixed(1)}" r="1" fill="#ccc"/>`)
  }
  return `<svg viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="56" stroke="#222" stroke-width="1.8"/>
    <circle cx="60" cy="60" r="50" stroke="#bbb" stroke-width="0.6"/>
    <g>${dots.join('')}</g>
    <line x1="28" y1="50" x2="52" y2="50" stroke="#aaa" stroke-width="0.5"/>
    <line x1="68" y1="50" x2="92" y2="50" stroke="#aaa" stroke-width="0.5"/>
    <line x1="28" y1="72" x2="92" y2="72" stroke="#aaa" stroke-width="0.5"/>
    <polygon points="60,30 61.8,35 67,35.5 63,38.8 64.2,44 60,41 55.8,44 57,38.8 53,35.5 58.2,35" fill="#222"/>
    <text x="60" y="65" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="13" font-weight="700" fill="#111" letter-spacing="2">${esc(SHOP_NAME).toUpperCase()}</text>
    <text x="60" y="83" text-anchor="middle" font-family="sans-serif" font-size="5.5" fill="#888" letter-spacing="1.5">${esc(SHOP_TAGLINE).toUpperCase()}</text>
    <text x="60" y="94" text-anchor="middle" font-family="sans-serif" font-size="5" fill="#aaa" letter-spacing="1">EST. ${esc(SHOP_EST_YEAR)}</text>
  </svg>`
}

function receiptItemHtml(line: OrderItem, catalog: PrintCatalog): string {
  const name = (line.item_id ? catalog.get(line.item_id)?.name : null) ?? line.name_text ?? '—'
  const price = line.unit_price ?? 0
  let html = `<li class="item"><span class="item-name">${esc(name)}</span><span class="item-dots"></span><span class="item-price">${formatRub(price * line.qty)}</span></li>`
  if (line.qty > 1) html += `<li class="item-qty">${line.qty} &times; ${formatRub(price)}</li>`
  return html
}

/** Builds the receipt body HTML — pass to `printPageHtml` with `RECEIPT_CSS`. */
export function receiptBodyHtml(
  order: Pick<Order, 'id' | 'telegram' | 'customer_email' | 'total_price' | 'delivery_method' | 'paid' | 'created_at'>,
  lines: OrderItem[],
  catalog: PrintCatalog,
): string {
  const customer = order.telegram || order.customer_email || 'Order'
  const date = formatDate(order.created_at)
  const total = order.total_price != null ? formatRub(order.total_price) : formatRub(linesTotal(lines))
  const sorted = sortLinesByPrice(lines)
  const itemCount = sorted.length
  const unitCount = sorted.reduce((s, l) => s + l.qty, 0)
  const shortId = order.id.length > 8 ? order.id.slice(0, 4) + '…' + order.id.slice(-4) : order.id

  const itemsHtml = sorted.map((l) => receiptItemHtml(l, catalog)).join('')

  const deliveryHtml = [
    order.delivery_method ? `<div class="delivery">Delivery: ${esc(order.delivery_method)}</div>` : '',
    order.paid ? '<div class="delivery"><span class="badge">Paid</span></div>' : '',
  ].filter(Boolean).join('')

  const tgDisplay = SHOP_TELEGRAM.replace(/^https?:\/\//, '')
  let qrSvg = ''
  try { qrSvg = generateQrSvg(SHOP_TELEGRAM) } catch { /* skip QR if URL too long */ }

  return `<div class="receipt">
  <div class="stamp">${stampSvg()}</div>
  <div class="meta"><span>${date}</span><span>${esc(customer)}</span></div>
  <div class="orn"><span>&#9670;</span></div>
  <ul class="items">${itemsHtml}</ul>
  <div class="orn"><span>&#9670;</span></div>
  <div class="summary">${itemCount} item${itemCount !== 1 ? 's' : ''} &middot; ${unitCount} unit${unitCount !== 1 ? 's' : ''}</div>
  <div class="total"><span class="label">Total</span><span class="amount">${total}</span></div>
  ${deliveryHtml ? `<div class="orn"><span>&#9670;</span></div>${deliveryHtml}` : ''}
  <div class="thanks">Спасибо за покупку!</div>
  <div class="stars">&#10038; &middot; &#10038; &middot; &#10038;</div>
  ${qrSvg ? `<div class="qr">${qrSvg}<span class="qr-link">${esc(tgDisplay)}</span></div>` : ''}
  <div class="receipt-id">${shortId}</div>
  <div class="bottom-orn">&#9670; &middot; &#9670; &middot; &#9670;</div>
</div>`
}

/** Opens the document in a new tab and triggers the browser's print dialog. */
export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
