// Remembers where you stopped: how the Orders list was filtered and scrolled,
// which order was open last, and whether order items are grouped by fandom.
//
// The value is cached in module scope so components can read it during render
// (a useState initializer) without touching storage, and written back on a
// short debounce so per-keystroke and per-scroll-frame updates stay cheap.

const KEY = 'merch:view-state'

export interface OrdersView {
  filter: string
  search: string
  delivery: string
  scrollY: number
}

export interface LastOrder {
  id: string
  label: string
}

interface ViewState {
  orders: OrdersView
  lastOrder: LastOrder | null
  groupByFandom: boolean
}

const DEFAULTS: ViewState = {
  orders: { filter: 'to_send', search: '', delivery: '', scrollY: 0 },
  lastOrder: null,
  groupByFandom: false,
}

function load(): ViewState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS, orders: { ...DEFAULTS.orders } }
    const parsed = JSON.parse(raw) as Partial<ViewState>
    return {
      orders: { ...DEFAULTS.orders, ...parsed.orders },
      lastOrder: parsed.lastOrder ?? null,
      groupByFandom: parsed.groupByFandom ?? false,
    }
  } catch {
    // Storage unavailable (private mode) or a corrupted value — start clean.
    return { ...DEFAULTS, orders: { ...DEFAULTS.orders } }
  }
}

let state = load()
let flushTimer: ReturnType<typeof setTimeout> | undefined

function write() {
  flushTimer = undefined
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota or private mode — the in-memory copy still serves this session.
  }
}

/** Persist immediately instead of waiting for the debounce. */
export function flushViewState() {
  if (flushTimer !== undefined) clearTimeout(flushTimer)
  write()
}

function schedule() {
  if (flushTimer === undefined) flushTimer = setTimeout(write, 400)
}

if (typeof window !== 'undefined') {
  // An installed PWA is usually killed rather than unloaded, so `pagehide` and
  // the hidden transition are the last reliable moments to persist.
  window.addEventListener('pagehide', flushViewState)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushViewState()
  })
}

export function ordersView(): OrdersView {
  return state.orders
}

export function saveOrdersView(patch: Partial<OrdersView>) {
  state = { ...state, orders: { ...state.orders, ...patch } }
  schedule()
}

export function lastOrder(): LastOrder | null {
  return state.lastOrder
}

export function rememberOrder(id: string, label: string) {
  if (state.lastOrder?.id === id && state.lastOrder.label === label) return
  state = { ...state, lastOrder: { id, label } }
  schedule()
}

export function forgetOrder() {
  state = { ...state, lastOrder: null }
  flushViewState()
}

export function fandomGrouping(): boolean {
  return state.groupByFandom
}

export function setFandomGrouping(on: boolean) {
  state = { ...state, groupByFandom: on }
  schedule()
}
