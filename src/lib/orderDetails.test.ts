import { describe, expect, it } from 'vitest'
import { localNoonISO } from './format'
import { detailsChanges, detailsForm, followServer } from './orderDetails'
import type { Order } from './types'

const order: Order = {
  id: 'o1',
  customer_email: null,
  telegram: '@kotik_lu',
  total_price: 1380,
  comment: null,
  paid: true,
  paid_at: localNoonISO('2026-09-22'),
  delivery_method: 'сдэк',
  delivery_details: 'СПб, ПВЗ на Невском',
  sent: false,
  delivered: false,
  created_at: '2026-09-21T10:00:00.000Z',
}

/** The same order as read before migration 010: no paid_at key at all. */
const before010: Order = { ...order }
delete before010.paid_at

describe('detailsForm', () => {
  it('holds every field as input text', () => {
    expect(detailsForm(order)).toEqual({
      telegram: '@kotik_lu',
      customer_email: '',
      total_price: '1380',
      paid_at: '2026-09-22',
      delivery_method: 'сдэк',
      delivery_details: 'СПб, ПВЗ на Невском',
      comment: '',
    })
  })
  it('leaves the paid date blank before migration 010 adds the column', () => {
    expect(detailsForm(before010).paid_at).toBe('')
  })
})

describe('detailsChanges', () => {
  it('is empty for an untouched form', () => {
    expect(detailsChanges(detailsForm(order), order)).toEqual({})
  })
  it('sends only what was edited', () => {
    const form = { ...detailsForm(order), delivery_details: 'Москва, до востребования' }
    expect(detailsChanges(form, order)).toEqual({ delivery_details: 'Москва, до востребования' })
  })
  it('compares the total as a number and clears blanked fields', () => {
    const form = detailsForm(order)
    expect(detailsChanges({ ...form, total_price: '1 380' }, order)).toEqual({})
    expect(detailsChanges({ ...form, total_price: '1 400' }, order)).toEqual({ total_price: 1400 })
    expect(detailsChanges({ ...form, total_price: '', telegram: '' }, order)).toEqual({ total_price: null, telegram: null })
  })
  it('sends an edited paid date as local noon, and never an untouched one', () => {
    const form = { ...detailsForm(order), paid_at: '2026-08-30' }
    expect(detailsChanges(form, order)).toEqual({ paid_at: localNoonISO('2026-08-30') })
    expect(detailsChanges(detailsForm(before010), before010)).toEqual({})
  })
})

describe('followServer', () => {
  const base = detailsForm(order)

  it('lets untouched fields follow the order and keeps typed ones', () => {
    const server = detailsForm({ ...order, comment: 'из другой вкладки', delivery_details: 'новый адрес' })
    const form = { ...base, delivery_details: 'набираю адрес…' }
    const next = followServer(form, base, server)
    expect(next.comment).toBe('из другой вкладки')
    expect(next.delivery_details).toBe('набираю адрес…')
  })

  it('always takes a new total or paid date, which only change by an explicit action', () => {
    const server = detailsForm({ ...order, total_price: 1170, paid_at: localNoonISO('2026-09-24') })
    const form = { ...base, total_price: '999', paid_at: '2026-01-01' }
    const next = followServer(form, base, server)
    expect(next.total_price).toBe('1170')
    expect(next.paid_at).toBe('2026-09-24')
  })

  it('keeps typed values where the order did not change', () => {
    const form = { ...base, total_price: '999', comment: 'заметка' }
    expect(followServer(form, base, base)).toEqual(form)
  })
})
