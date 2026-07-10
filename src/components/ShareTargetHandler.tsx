import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { takeSharedText } from '../lib/shareTarget'
import { importedOrderRows, importedTotal, parseImportCode } from '../lib/importCode'
import { showToast } from '../lib/toast'

/**
 * When the app is opened via the Android share sheet (share_target in the
 * manifest), turn the shared store-cart message into a new order and open it.
 * Renders nothing; mounted once the user is logged in.
 */
export default function ShareTargetHandler() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    const text = takeSharedText()
    if (!text) return
    const lines = parseImportCode(text)
    if (!lines) {
      showToast('No order code in the shared text')
      return
    }
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .insert({ total_price: importedTotal(lines) })
          .select()
          .single()
        if (error) throw error
        const order = data as Order
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(importedOrderRows(order.id, lines))
        if (itemsError) throw itemsError
        qc.invalidateQueries({ queryKey: ['orders'] })
        qc.invalidateQueries({ queryKey: ['order_items', order.id] })
        showToast('Order created from shared cart')
        navigate(`/orders/${order.id}`)
      } catch (err) {
        showToast(`Could not create the order: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    })()
  }, [navigate, qc])

  return null
}
