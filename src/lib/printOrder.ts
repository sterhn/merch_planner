import type { Order, OrderItem } from './types'
import { formatRub } from './format'
import { NO_FANDOM_LABEL, type FandomGroup } from './orderLines'

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

/** Opens the document in a new tab and triggers the browser's print dialog. */
export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
