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

/** Opens the document in a new tab and triggers the browser's print dialog. */
export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
