import type { Item, Order, OrderItem } from './types'
import { formatRub } from './format'

// Renders an order as a shareable PNG styled with the store's light-theme
// design tokens, so clients can recheck their order in a messenger.

const SCALE = 2 // export at 2x for crisp text in messengers
const W = 560
const MARGIN = 24
const CARD_PAD = 20
const THUMB = 48

const SANS = '"Manrope Variable", ui-sans-serif, system-ui, sans-serif'
const DISPLAY = '"Lora Variable", Georgia, serif'

interface Palette {
  page: string
  surface: string
  surface2: string
  ink: string
  inkMuted: string
  inkFaint: string
  line: string
  brand: string
  good: string
}

// The client-facing image always uses the light palette regardless of the
// device theme: light-dark() tokens resolve against the probe's color-scheme.
function resolvePalette(): Palette {
  const probe = document.createElement('div')
  probe.style.colorScheme = 'light'
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const read = (token: string) => {
    probe.style.color = `var(${token})`
    return getComputedStyle(probe).color
  }
  const palette: Palette = {
    page: read('--color-page'),
    surface: read('--color-surface'),
    surface2: read('--color-surface-2'),
    ink: read('--color-ink'),
    inkMuted: read('--color-ink-muted'),
    inkFaint: read('--color-ink-faint'),
    line: read('--color-line'),
    brand: read('--color-brand'),
    good: read('--color-good'),
  }
  probe.remove()
  return palette
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // required so the canvas stays exportable
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Greedy word wrap; the first line may have its own (smaller) width for hanging labels. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, firstMax = maxWidth): string[] {
  const lines: string[] = []
  let line = ''
  const limit = () => (lines.length === 0 ? firstMax : maxWidth)
  for (let word of text.split(/\s+/).filter(Boolean)) {
    if (line && ctx.measureText(line + ' ' + word).width <= limit()) {
      line = line + ' ' + word
      continue
    }
    if (line) lines.push(line)
    // Hard-break words longer than a whole line (long URLs, tracking codes).
    while (ctx.measureText(word).width > limit() && word.length > 1) {
      let i = word.length - 1
      while (i > 1 && ctx.measureText(word.slice(0, i)).width > limit()) i--
      lines.push(word.slice(0, i))
      word = word.slice(i)
    }
    line = word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function clampLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, maxWidth: number): string[] {
  if (lines.length <= max) return lines
  const out = lines.slice(0, max)
  let last = out[max - 1]
  while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
  out[max - 1] = last + '…'
  return out
}

/** Cover-fit an image into a rounded square, like object-cover. */
function drawThumb(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number) {
  ctx.save()
  roundRect(ctx, x, y, THUMB, THUMB, 12)
  ctx.clip()
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, y, THUMB, THUMB)
  ctx.restore()
}

export async function renderOrderImage(order: Order, lines: OrderItem[], catalog: Map<string, Item>): Promise<Blob> {
  await document.fonts.ready
  await Promise.all([
    document.fonts.load(`600 26px ${DISPLAY}`),
    document.fonts.load(`600 15px ${SANS}`),
  ]).catch(() => {})

  const palette = resolvePalette()

  const rows = await Promise.all(
    lines.map(async (l) => {
      const item = l.item_id ? catalog.get(l.item_id) : undefined
      return {
        name: item?.name ?? l.name_text ?? '—',
        category: l.category,
        qty: l.qty,
        unit: l.unit_price,
        image: item?.image_url ? await loadImage(item.image_url) : null,
      }
    }),
  )
  const linesTotal = lines.reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0)

  const customer = order.telegram || order.customer_email || 'Order'
  const date = new Date(order.created_at).toLocaleDateString('ru-RU')
  const statuses: { label: string; on: boolean }[] = [
    { label: 'paid', on: order.paid },
    { label: 'sent', on: order.sent },
    { label: 'delivered', on: order.delivered },
  ]

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported')

  const contentW = W - MARGIN * 2
  const cardInner = contentW - CARD_PAD * 2

  // --- measure pass ---
  ctx.font = `600 15px ${SANS}`
  const priceW = Math.max(
    64,
    ...rows.map((r) => ctx.measureText(formatRub(r.unit != null ? r.unit * r.qty : null)).width),
  )
  const nameW = cardInner - THUMB - 12 - priceW - 12

  const measured = rows.map((r) => {
    ctx.font = `600 15px ${SANS}`
    const nameLines = clampLines(ctx, wrapText(ctx, r.name, nameW), 2, nameW)
    const leftH = nameLines.length * 20 + (r.category ? 16 : 0)
    const rightH = 20 + (r.qty > 1 ? 16 : 0)
    return { ...r, nameLines, rowH: Math.max(THUMB, leftH, rightH) }
  })

  const info: [string, string][] = []
  if (order.delivery_method) info.push(['Delivery', order.delivery_method])
  if (order.delivery_details) info.push(['Address', order.delivery_details])
  if (order.customer_email) info.push(['Email', order.customer_email])
  if (order.comment) info.push(['Comment', order.comment])

  const infoRows = info.map(([label, value]) => {
    ctx.font = `700 13px ${SANS}`
    const labelW = ctx.measureText(label + ':  ').width
    ctx.font = `500 13px ${SANS}`
    return { label, labelW, valueLines: wrapText(ctx, value, cardInner, cardInner - labelW) }
  })

  let itemsCardH = CARD_PAD + 18 + 8 // padding + "Items" title + gap
  if (measured.length === 0) itemsCardH += 24
  for (const r of measured) itemsCardH += r.rowH + 14
  itemsCardH += 4 + 16 // gap + items total line
  if (order.total_price != null) itemsCardH += 10 + 28
  itemsCardH += CARD_PAD

  const infoCardH =
    infoRows.length > 0
      ? CARD_PAD + infoRows.reduce((s, r) => s + r.valueLines.length * 19, 0) + (infoRows.length - 1) * 8 + CARD_PAD
      : 0

  const height =
    MARGIN + 32 + 20 + 16 + 34 + 20 + itemsCardH + (infoCardH ? 16 + infoCardH : 0) + MARGIN

  // --- draw pass ---
  canvas.width = W * SCALE
  canvas.height = Math.ceil(height) * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'top'

  ctx.fillStyle = palette.page
  ctx.fillRect(0, 0, W, height)

  let y = MARGIN

  // header: customer + date
  ctx.fillStyle = palette.ink
  ctx.font = `600 26px ${DISPLAY}`
  ctx.fillText(clampLines(ctx, wrapText(ctx, customer, contentW), 1, contentW)[0], MARGIN, y)
  y += 32
  ctx.fillStyle = palette.inkMuted
  ctx.font = `500 13px ${SANS}`
  ctx.fillText(date, MARGIN, y)
  y += 20 + 16

  // status chips, like the order page badges
  const chipW = (contentW - 16) / 3
  statuses.forEach((s, i) => {
    const x = MARGIN + i * (chipW + 8)
    roundRect(ctx, x, y, chipW, 34, 17)
    if (s.on) {
      ctx.save()
      ctx.globalAlpha = 0.14
      ctx.fillStyle = palette.good
      ctx.fill()
      ctx.restore()
    } else {
      ctx.fillStyle = palette.surface2
      ctx.fill()
    }
    ctx.fillStyle = s.on ? palette.good : palette.inkFaint
    ctx.font = `700 13px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText(s.on ? `✓ ${s.label}` : s.label, x + chipW / 2, y + 10)
    ctx.textAlign = 'left'
  })
  y += 34 + 20

  // items card
  ctx.save()
  ctx.shadowColor = 'rgba(60, 50, 30, 0.08)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 3
  ctx.fillStyle = palette.surface
  roundRect(ctx, MARGIN, y, contentW, itemsCardH, 20)
  ctx.fill()
  ctx.restore()

  const cardX = MARGIN + CARD_PAD
  const cardRight = MARGIN + contentW - CARD_PAD
  let cy = y + CARD_PAD

  ctx.fillStyle = palette.inkMuted
  ctx.font = `600 13px ${DISPLAY}`
  ctx.fillText('Items', cardX, cy)
  cy += 18 + 8

  if (measured.length === 0) {
    ctx.fillStyle = palette.inkFaint
    ctx.font = `500 14px ${SANS}`
    ctx.fillText('No items.', cardX, cy + 4)
    cy += 24
  }

  measured.forEach((r, i) => {
    if (i > 0) {
      ctx.strokeStyle = palette.line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardX, cy - 7)
      ctx.lineTo(cardRight, cy - 7)
      ctx.stroke()
    }

    const thumbY = cy + (r.rowH - THUMB) / 2
    if (r.image) {
      drawThumb(ctx, r.image, cardX, thumbY)
    } else {
      ctx.fillStyle = palette.surface2
      roundRect(ctx, cardX, thumbY, THUMB, THUMB, 12)
      ctx.fill()
    }

    const leftH = r.nameLines.length * 20 + (r.category ? 16 : 0)
    let ty = cy + (r.rowH - leftH) / 2
    ctx.fillStyle = palette.ink
    ctx.font = `600 15px ${SANS}`
    for (const line of r.nameLines) {
      ctx.fillText(line, cardX + THUMB + 12, ty + 2)
      ty += 20
    }
    if (r.category) {
      ctx.fillStyle = palette.inkFaint
      ctx.font = `500 12px ${SANS}`
      ctx.fillText(r.category, cardX + THUMB + 12, ty + 2)
    }

    const rightH = 20 + (r.qty > 1 ? 16 : 0)
    let ry = cy + (r.rowH - rightH) / 2
    ctx.textAlign = 'right'
    ctx.fillStyle = palette.ink
    ctx.font = `600 15px ${SANS}`
    ctx.fillText(formatRub(r.unit != null ? r.unit * r.qty : null), cardRight, ry + 2)
    ry += 20
    if (r.qty > 1) {
      ctx.fillStyle = palette.inkFaint
      ctx.font = `500 12px ${SANS}`
      ctx.fillText(`${r.qty} × ${formatRub(r.unit)}`, cardRight, ry + 2)
    }
    ctx.textAlign = 'left'

    cy += r.rowH + 14
  })

  cy += 4
  ctx.textAlign = 'right'
  ctx.fillStyle = palette.inkMuted
  ctx.font = `600 12px ${DISPLAY}`
  ctx.fillText(`items total: ${formatRub(linesTotal)}`, cardRight, cy)
  cy += 16
  if (order.total_price != null) {
    cy += 10
    ctx.fillStyle = palette.brand
    ctx.font = `600 22px ${DISPLAY}`
    ctx.fillText(`Total: ${formatRub(order.total_price)}`, cardRight, cy)
  }
  ctx.textAlign = 'left'
  y += itemsCardH

  // delivery / contact card
  if (infoRows.length > 0) {
    y += 16
    ctx.save()
    ctx.shadowColor = 'rgba(60, 50, 30, 0.08)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 3
    ctx.fillStyle = palette.surface
    roundRect(ctx, MARGIN, y, contentW, infoCardH, 20)
    ctx.fill()
    ctx.restore()

    let iy = y + CARD_PAD
    for (const r of infoRows) {
      ctx.fillStyle = palette.ink
      ctx.font = `700 13px ${SANS}`
      ctx.fillText(`${r.label}:`, cardX, iy)
      ctx.fillStyle = palette.inkMuted
      ctx.font = `500 13px ${SANS}`
      r.valueLines.forEach((line, i) => {
        ctx.fillText(line, cardX + (i === 0 ? r.labelW : 0), iy)
        iy += 19
      })
      iy += 8
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export image')) // e.g. canvas tainted by a non-CORS image
    }, 'image/png')
  })
}

/** Share the image via the native share sheet, or download it where sharing isn't available. */
export async function shareOrderImage(blob: Blob, filename: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // NotAllowedError etc. — fall through to a plain download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
