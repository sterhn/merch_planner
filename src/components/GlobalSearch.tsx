import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Collect, Item, OrderWithPhotos } from '../lib/types'
import { useList } from '../hooks/useTable'
import { formatDate, formatRub } from '../lib/format'
import { haptic } from '../lib/haptics'
import { searchAll } from '../lib/search'
import Modal from './Modal'
import SearchInput from './SearchInput'
import { SECTIONS } from './sections'
import { TONE_BLOB } from './tones'

/** Rows shown per group before "and N more". */
const PER_GROUP = 5

interface Hit {
  key: string
  to: string
  title: string
  detail: string
  aside?: React.ReactNode
  image?: string | null
}

const statusLabel = (o: OrderWithPhotos) =>
  o.delivered ? 'delivered' : o.sent ? 'shipped' : o.paid ? 'awaiting shipment' : 'unpaid'

/**
 * One box for everything: orders (by contact or item), catalog items (name,
 * SKU, fandom, type) and collects (name, vendor). Mount it only while open —
 * it reads the same cached lists the pages use.
 */
export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  // Same select as the Orders page, so both share one cache entry.
  const { data: orders } = useList<OrderWithPhotos>('orders', {
    orderBy: 'created_at',
    ascending: false,
    select: '*, order_items(name_text, item:item_id(name, image_url))',
  })
  const { data: items } = useList<Item>('items', { orderBy: 'name' })
  const { data: collects } = useList<Collect>('collects', { orderBy: 'created_at', ascending: false })

  const [text, setText] = useState('')
  const query = useDeferredValue(text)

  const groups = useMemo(() => {
    if (!query.trim()) return []
    const found = searchAll(query, { orders, items, collects })
    const orderHits: Hit[] = found.orders.map((o) => ({
      key: o.id,
      to: `/orders/${o.id}`,
      title: o.telegram || o.customer_email || 'no contact',
      detail: `${formatDate(o.created_at)} · ${statusLabel(o)}`,
      aside: <span className="font-display text-sm">{formatRub(o.total_price)}</span>,
      image: o.order_items?.find((oi) => oi.item?.image_url)?.item?.image_url,
    }))
    const itemHits: Hit[] = found.items.map((i) => ({
      key: i.id,
      to: `/catalog?open=${i.id}`,
      title: i.archived ? `${i.name} (archived)` : i.name,
      detail: [i.type, i.fandom, `stock ${i.stock_qty ?? 0}`].filter(Boolean).join(' · '),
      aside: <span className="font-display text-sm">{formatRub(i.sale_price)}</span>,
      image: i.image_url,
    }))
    const collectHits: Hit[] = found.collects.map((c) => ({
      key: c.id,
      to: `/collects?open=${c.id}`,
      title: c.name ?? '—',
      detail: [c.vendor, c.received_at ? 'received' : c.paid ? 'paid' : 'not paid'].filter(Boolean).join(' · '),
      aside: <span className="font-display text-sm">{formatRub(c.total_cost)}</span>,
    }))
    return [
      { section: SECTIONS.orders, hits: orderHits },
      { section: SECTIONS.catalog, hits: itemHits },
      { section: SECTIONS.collects, hits: collectHits },
    ].filter((g) => g.hits.length > 0)
  }, [query, orders, items, collects])

  const first = groups[0]?.hits[0]

  function go(hit: Hit) {
    haptic(5)
    onClose()
    navigate(hit.to)
  }

  return (
    <Modal title="Search everything" open onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (first) go(first)
        }}
      >
        <SearchInput
          className="mb-3"
          label="Search orders, items and collects"
          placeholder="Customer, item, SKU, collect…"
          value={text}
          onChange={setText}
          autoFocus
        />
      </form>

      {!query.trim() ? (
        <p className="py-6 text-center text-sm text-ink-muted">Find any order, item or collect by name.</p>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nothing matches “{text.trim()}”.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ section, hits }) => (
            <section key={section.to}>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                <section.icon size={13} />
                {section.label}
                <span className="font-semibold">· {hits.length}</span>
              </h3>
              <ul className="divide-y divide-line rounded-control border border-line">
                {hits.slice(0, PER_GROUP).map((h) => (
                  <li key={h.key}>
                    <button
                      type="button"
                      onClick={() => go(h)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2"
                    >
                      {h.image ? (
                        <img src={h.image} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${TONE_BLOB[section.tone]}`} aria-hidden>
                          <section.icon size={16} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{h.title}</span>
                        <span className="block truncate text-xs text-ink-muted">{h.detail}</span>
                      </span>
                      <span className="shrink-0">{h.aside}</span>
                      <ChevronRight size={15} className="-mr-1 shrink-0 text-ink-faint" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {hits.length > PER_GROUP && (
                <p className="mt-1 text-xs text-ink-muted">and {hits.length - PER_GROUP} more — keep typing to narrow it down</p>
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}
