// Remembers where you stopped: how the Orders list was filtered and scrolled,
// which order was open last, whether order items are grouped by fandom, and
// the Catalog and Collects filters.
//
// The value is cached in module scope so components can read it during render
// (a useState initializer) without touching storage, and written back on a
// short debounce so per-keystroke and per-scroll-frame updates stay cheap.

const KEY = 'merch:view-state'

export interface OrdersView {
  filter: string
  search: string
  delivery: string
  /** An OrderSort key. */
  sort: string
  scrollY: number
}

export interface CatalogView {
  search: string
  type: string | null
  fandom: string | null
  /** Show archived items instead of the live catalog. */
  archived: boolean
  /** List rows, or a photo grid. */
  layout: 'list' | 'grid'
  /** A CatalogSort key (lib/catalogSort). */
  sort: string
}

export interface CollectsView {
  search: string
  status: string
}

/** Packing-day ticks: order line ids packed, pick-list keys picked. */
export interface PackingTicks {
  packed: string[]
  picked: string[]
}

export interface LastOrder {
  id: string
  label: string
}

interface ViewState {
  orders: OrdersView
  lastOrder: LastOrder | null
  groupByFandom: boolean
  catalog: CatalogView
  collects: CollectsView
  packing: PackingTicks
}

const DEFAULTS: ViewState = {
  orders: { filter: 'to_send', search: '', delivery: '', sort: 'newest', scrollY: 0 },
  lastOrder: null,
  groupByFandom: false,
  catalog: { search: '', type: null, fandom: null, archived: false, layout: 'list', sort: 'type' },
  collects: { search: '', status: 'all' },
  packing: { packed: [], picked: [] },
}

function fresh(): ViewState {
  return {
    ...DEFAULTS,
    orders: { ...DEFAULTS.orders },
    catalog: { ...DEFAULTS.catalog },
    collects: { ...DEFAULTS.collects },
    packing: { packed: [], picked: [] },
  }
}

function load(): ViewState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const parsed = JSON.parse(raw) as Partial<ViewState>
    return {
      orders: { ...DEFAULTS.orders, ...parsed.orders },
      lastOrder: parsed.lastOrder ?? null,
      groupByFandom: parsed.groupByFandom ?? false,
      catalog: { ...DEFAULTS.catalog, ...parsed.catalog },
      collects: { ...DEFAULTS.collects, ...parsed.collects },
      packing: {
        packed: Array.isArray(parsed.packing?.packed) ? parsed.packing.packed : [],
        picked: Array.isArray(parsed.packing?.picked) ? parsed.packing.picked : [],
      },
    }
  } catch {
    // Storage unavailable (private mode) or a corrupted value — start clean.
    return fresh()
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

export function catalogView(): CatalogView {
  return state.catalog
}

export function saveCatalogView(patch: Partial<CatalogView>) {
  state = { ...state, catalog: { ...state.catalog, ...patch } }
  schedule()
}

export function collectsView(): CollectsView {
  return state.collects
}

export function saveCollectsView(patch: Partial<CollectsView>) {
  state = { ...state, collects: { ...state.collects, ...patch } }
  schedule()
}

export function packingTicks(): PackingTicks {
  return state.packing
}

export function savePackingTicks(patch: Partial<PackingTicks>) {
  state = { ...state, packing: { ...state.packing, ...patch } }
  schedule()
}
