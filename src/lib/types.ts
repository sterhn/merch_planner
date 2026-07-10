export interface Item {
  id: string
  type: string | null
  fandom: string | null
  sku: string | null
  name: string
  description: string | null
  image_url: string | null
  cost_price: number | null
  sale_price: number | null
  profit: number | null
  stock_qty: number | null
  created_at: string
}

export interface OrderWithPhotos extends Order {
  order_items: { item: { image_url: string | null } | null }[]
}

export const DELIVERY_METHODS = [
  'почта',
  'сдэк',
  'яндекс',
  'озон',
  'самовывоз мск',
  'самовывоз спб',
] as const

export interface Order {
  id: string
  customer_email: string | null
  telegram: string | null
  total_price: number | null
  comment: string | null
  paid: boolean
  delivery_method: string | null
  delivery_details: string | null
  sent: boolean
  delivered: boolean
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string | null
  name_text: string | null
  category: string | null
  qty: number
  unit_price: number | null
  created_at: string
}

export interface Collect {
  id: string
  name: string | null
  vendor: string | null
  qty: number | null
  print_cost: number | null
  commission: number | null
  delivery_cost: number | null
  deadline: string | null
  paid: boolean
  total_cost: number | null
  cost_per_unit: number | null
  created_at: string
}

export interface ShelfItem {
  id: string
  name: string
  price: number | null
  month: string | null
  shop: string | null
  qty_sent: number | null
  qty_sold: number | null
  qty_remaining: number | null
  income: number | null
  created_at: string
}

export const EXPENSE_CATEGORIES = [
  'shelf_rent',
  'supplies',
  'shipping',
  'other',
] as const

export interface Expense {
  id: string
  date: string
  category: (typeof EXPENSE_CATEGORIES)[number]
  description: string | null
  amount: number
  created_at: string
}

export interface ExpenseFeedRow {
  id: string
  date: string
  category: string
  description: string | null
  amount: number
  source: 'manual' | 'collect'
}
