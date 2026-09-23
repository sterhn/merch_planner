import { House, PiggyBank, Printer, ShoppingBag, Sticker, type LucideIcon } from 'lucide-react'
import type { Tone } from './tones'

/**
 * The app's top-level sections. Each has its own icon and colour, shared by the
 * nav and the page header so a page always looks like the tab that opened it.
 */
export const SECTIONS = {
  home: { to: '/', label: 'Home', icon: House, tone: 'brand' },
  orders: { to: '/orders', label: 'Orders', icon: ShoppingBag, tone: 'accent' },
  catalog: { to: '/catalog', label: 'Catalog', icon: Sticker, tone: 'good' },
  collects: { to: '/collects', label: 'Collects', icon: Printer, tone: 'sky' },
  expenses: { to: '/expenses', label: 'Expenses', icon: PiggyBank, tone: 'peach' },
} as const satisfies Record<string, { to: string; label: string; icon: LucideIcon; tone: Tone }>

export type SectionKey = keyof typeof SECTIONS
