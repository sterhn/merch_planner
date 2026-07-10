import type { Item, Order, OrderItem } from './types'
import { formatRub } from './format'

// Renders an order as a shareable PNG styled like the public store page
// (sterhn/merch_page): dark ground, cream serif, teal accents, sharp-cornered
// bordered cards with ✦ ornaments — so clients can recheck their order.

const SCALE = 2 // export at 2x for crisp text in messengers
const W = 560
const MARGIN = 28
const CARD_PAD = 18
const THUMB = 48

// Palette lifted from the store page's :root variables.
const BG = '#110e16'
const SURFACE = '#1a1520'
const INK = '#ede5da'
const MUTED = '#8a7e72'
const BORDER = 'rgba(138, 126, 114, 0.22)'
const DIVIDER = 'rgba(138, 126, 114, 0.14)'
const ACCENT = '#5aa0a0'

// Store fonts. DM Sans has no Cyrillic — like on the store page itself it is
// only used for uppercase Latin labels; Cyrillic values fall back to system sans.
const SERIF = '"Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif'
const SANS = '"DM Sans Variable", "DM Sans", ui-sans-serif, system-ui, sans-serif'

async function loadFonts() {
  // Loaded on demand so the store fonts stay out of the app's initial bundle.
  await Promise.all([
    import('@fontsource-variable/cormorant-garamond/index.css'),
    import('@fontsource-variable/dm-sans/index.css'),
  ])
  await Promise.all([
    document.fonts.load(`700 30px ${SERIF}`, 'ЗАКАЗ ORDER ₽'),
    document.fonts.load(`600 17px ${SERIF}`, 'шоколадка item ₽'),
    document.fonts.load(`700 17px ${SERIF}`, '1 250 ₽'),
    document.fonts.load(`600 11px ${SANS}`, 'ITEMS TOTAL'),
  ]).catch(() => {})
  await document.fonts.ready
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

/** Four-pointed ✦ sparkle, drawn as a path so it never depends on glyph coverage. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const k = 0.22
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + r * k, y - r * k, x + r, y)
  ctx.quadraticCurveTo(x + r * k, y + r * k, x, y + r)
  ctx.quadraticCurveTo(x - r * k, y + r * k, x - r, y)
  ctx.quadraticCurveTo(x - r * k, y - r * k, x, y - r)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/** Bordered sharp-cornered card with the store's corner brackets (top-left, bottom-right). */
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = SURFACE
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.strokeStyle = ACCENT
  ctx.globalAlpha = 0.75
  ctx.beginPath()
  ctx.moveTo(x + 6.5, y + 20)
  ctx.lineTo(x + 6.5, y + 6.5)
  ctx.lineTo(x + 20, y + 6.5)
  ctx.moveTo(x + w - 6.5, y + h - 20)
  ctx.lineTo(x + w - 6.5, y + h - 6.5)
  ctx.lineTo(x + w - 20, y + h - 6.5)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Section heading like the store's fandom sections: ✦ Title ————— */
function sectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number) {
  sparkle(ctx, MARGIN + 6, y + 11, 6, ACCENT)
  ctx.fillStyle = INK
  ctx.font = `700 20px ${SERIF}`
  ctx.fillText(title, MARGIN + 20, y)
  const textEnd = MARGIN + 20 + ctx.measureText(title).width
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(textEnd + 14, y + 11.5)
  ctx.lineTo(W - MARGIN, y + 11.5)
  ctx.stroke()
}

/** Cover-fit an image into a sharp-cornered square, like the store's card photos. */
function drawThumb(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, x: number, y: number) {
  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, THUMB, THUMB)
    ctx.clip()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, y, THUMB, THUMB)
    ctx.restore()
  } else {
    // Store-style placeholder: dim serif initial on the surface.
    ctx.fillStyle = '#241d2e'
    ctx.fillRect(x, y, THUMB, THUMB)
    ctx.fillStyle = MUTED
    ctx.font = `600 24px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.fillText(name.trim().charAt(0).toUpperCase() || '?', x + THUMB / 2, y + 12)
    ctx.textAlign = 'left'
  }
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, THUMB - 1, THUMB - 1)
}

export async function renderOrderImage(order: Order, lines: OrderItem[], catalog: Map<string, Item>): Promise<Blob> {
  await loadFonts()

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

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported')

  const contentW = W - MARGIN * 2
  const cardInner = contentW - CARD_PAD * 2

  // --- measure pass ---
  ctx.font = `700 30px ${SERIF}`
  let titleSize = 30
  const title = customer.toUpperCase()
  while (titleSize > 16 && ctx.measureText(title).width > contentW) {
    titleSize -= 1
    ctx.font = `700 ${titleSize}px ${SERIF}`
  }
  const titleW = ctx.measureText(title).width

  ctx.font = `700 17px ${SERIF}`
  const priceW = Math.max(
    64,
    ...rows.map((r) => ctx.measureText(formatRub(r.unit != null ? r.unit * r.qty : null)).width),
  )
  const nameW = cardInner - THUMB - 14 - priceW - 14

  const measured = rows.map((r) => {
    ctx.font = `600 17px ${SERIF}`
    const nameLines = clampLines(ctx, wrapText(ctx, r.name, nameW), 2, nameW)
    const leftH = nameLines.length * 21 + (r.category ? 15 : 0)
    const rightH = 21 + (r.qty > 1 ? 15 : 0)
    return { ...r, nameLines, rowH: Math.max(THUMB, leftH, rightH) }
  })

  // Client-facing info: delivery only — no status, email, or comment.
  const info: [string, string][] = []
  if (order.delivery_method) info.push(['Delivery', order.delivery_method])
  if (order.delivery_details) info.push(['Address', order.delivery_details])

  ctx.font = `500 13px ${SANS}`
  const infoRows = info.map(([label, value]) => ({
    label: label.toUpperCase(),
    valueLines: wrapText(ctx, value, cardInner),
  }))

  let itemsCardH = CARD_PAD
  if (measured.length === 0) itemsCardH += 24
  measured.forEach((r, i) => (itemsCardH += r.rowH + (i > 0 ? 16 : 0)))
  itemsCardH += 14 + 15 // gap + items total line
  if (order.total_price != null) itemsCardH += 12 + 30
  itemsCardH += CARD_PAD

  const infoCardH =
    infoRows.length > 0
      ? CARD_PAD +
        infoRows.reduce((s, r) => s + 16 + r.valueLines.length * 19, 0) +
        (infoRows.length - 1) * 14 +
        CARD_PAD
      : 0

  const headerH = 30 + titleSize + 10 + 15 + 18 + 12 // top pad, title, gap, date, gap, rule
  const height =
    headerH +
    18 +
    28 + // items section title
    itemsCardH +
    (infoCardH ? 26 + 28 + infoCardH : 0) +
    24 + // footer ornament
    30

  // --- draw pass ---
  canvas.width = W * SCALE
  canvas.height = Math.ceil(height) * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'top'

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, height)

  let y = 30

  // header: shimmer-gradient serif title, like the store's HEHEARSE masthead
  const grad = ctx.createLinearGradient((W - titleW) / 2, 0, (W + titleW) / 2, 0)
  grad.addColorStop(0, '#c8b8a8')
  grad.addColorStop(0.3, '#f0e8de')
  grad.addColorStop(0.5, ACCENT)
  grad.addColorStop(0.7, '#f0e8de')
  grad.addColorStop(1, '#c8b8a8')
  ctx.fillStyle = grad
  ctx.font = `700 ${titleSize}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.fillText(title, W / 2, y)
  y += titleSize + 10

  ctx.fillStyle = MUTED
  ctx.font = `600 11px ${SANS}`
  ctx.fillText(date.split('').join(' '), W / 2, y) // hair-spaced, like the store's letterspaced labels
  ctx.textAlign = 'left'
  y += 15 + 18

  // header rule: fading lines around a sparkle
  for (const dir of [-1, 1] as const) {
    const lineGrad = ctx.createLinearGradient(W / 2 + dir * 24, 0, W / 2 + dir * 144, 0)
    lineGrad.addColorStop(0, 'rgba(90, 160, 160, 0.4)')
    lineGrad.addColorStop(1, 'rgba(90, 160, 160, 0)')
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W / 2 + dir * 24, y + 0.5)
    ctx.lineTo(W / 2 + dir * 144, y + 0.5)
    ctx.stroke()
  }
  sparkle(ctx, W / 2, y, 7, ACCENT)
  y += 12 + 18

  // items
  sectionTitle(ctx, 'Items', y)
  y += 28
  card(ctx, MARGIN, y, contentW, itemsCardH)

  const cardX = MARGIN + CARD_PAD
  const cardRight = MARGIN + contentW - CARD_PAD
  let cy = y + CARD_PAD

  if (measured.length === 0) {
    ctx.fillStyle = MUTED
    ctx.font = `500 14px ${SANS}`
    ctx.fillText('No items.', cardX, cy + 4)
    cy += 24
  }

  measured.forEach((r, i) => {
    if (i > 0) {
      cy += 16
      ctx.strokeStyle = DIVIDER
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardX, cy - 8.5)
      ctx.lineTo(cardRight, cy - 8.5)
      ctx.stroke()
    }

    drawThumb(ctx, r.image, r.name, cardX, cy + (r.rowH - THUMB) / 2)

    const leftH = r.nameLines.length * 21 + (r.category ? 15 : 0)
    let ty = cy + (r.rowH - leftH) / 2
    if (r.category) {
      ctx.fillStyle = ACCENT
      ctx.font = `600 9px ${SANS}`
      ctx.fillText(r.category.toUpperCase().split('').join(' '), cardX + THUMB + 14, ty + 2)
      ty += 15
    }
    ctx.fillStyle = INK
    ctx.font = `600 17px ${SERIF}`
    for (const line of r.nameLines) {
      ctx.fillText(line, cardX + THUMB + 14, ty + 2)
      ty += 21
    }

    const rightH = 21 + (r.qty > 1 ? 15 : 0)
    let ry = cy + (r.rowH - rightH) / 2
    ctx.textAlign = 'right'
    ctx.fillStyle = ACCENT
    ctx.font = `700 17px ${SERIF}`
    ctx.fillText(formatRub(r.unit != null ? r.unit * r.qty : null), cardRight, ry + 2)
    ry += 21
    if (r.qty > 1) {
      ctx.fillStyle = MUTED
      ctx.font = `500 11px ${SANS}`
      ctx.fillText(`${r.qty} × ${formatRub(r.unit)}`, cardRight, ry + 2)
    }
    ctx.textAlign = 'left'

    cy += r.rowH
  })

  cy += 14
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = `600 11px ${SANS}`
  ctx.fillText(`ITEMS TOTAL: ${formatRub(linesTotal)}`, cardRight, cy)
  cy += 15
  if (order.total_price != null) {
    cy += 12
    ctx.fillStyle = ACCENT
    ctx.font = `700 26px ${SERIF}`
    ctx.fillText(`Total: ${formatRub(order.total_price)}`, cardRight, cy)
  }
  ctx.textAlign = 'left'
  y += itemsCardH

  // delivery
  if (infoRows.length > 0) {
    y += 26
    sectionTitle(ctx, 'Delivery', y)
    y += 28
    card(ctx, MARGIN, y, contentW, infoCardH)
    let iy = y + CARD_PAD
    for (const r of infoRows) {
      ctx.fillStyle = ACCENT
      ctx.font = `600 9px ${SANS}`
      ctx.fillText(r.label.split('').join(' '), cardX, iy)
      iy += 16
      ctx.fillStyle = INK
      ctx.font = `500 13px ${SANS}`
      for (const line of r.valueLines) {
        ctx.fillText(line, cardX, iy)
        iy += 19
      }
      iy += 14
    }
    y += infoCardH
  }

  // footer ornament
  sparkle(ctx, W / 2, y + 24 + 7, 5, 'rgba(90, 160, 160, 0.5)')

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
