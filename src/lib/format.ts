export function formatRub(value: number | null | undefined): string {
  if (value == null) return '—'
  // Non-breaking space so the ₽ never wraps to its own line
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' ₽'
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU')
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}
