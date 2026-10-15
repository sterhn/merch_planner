import { ChartLine, House, PiggyBank, Printer, Settings2, ShoppingBag, Sticker, type LucideIcon } from 'lucide-react'
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

/**
 * Settings sits outside the tab bar (five tabs is the comfortable maximum on a
 * phone): the sidebar lists it on desktop, the dashboard header links it on mobile.
 */
export const SETTINGS = { to: '/settings', label: 'Settings', icon: Settings2, tone: 'brand' } as const satisfies {
  to: string
  label: string
  icon: LucideIcon
  tone: Tone
}

/** Insights is a read-only overview: sidebar on desktop, a link from the dashboard on mobile. */
export const INSIGHTS = { to: '/insights', label: 'Insights', icon: ChartLine, tone: 'sun' } as const satisfies {
  to: string
  label: string
  icon: LucideIcon
  tone: Tone
}
