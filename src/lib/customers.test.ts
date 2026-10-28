import { describe, expect, it } from 'vitest'
import { findCustomer, knownCustomers } from './customers'

const o = (telegram: string | null, created_at: string) => ({ telegram, created_at })

describe('knownCustomers', () => {
  const orders = [
    o('@Mira ', '2026-10-20T10:00:00Z'),
    o(null, '2026-10-19T10:00:00Z'),
    o('@mira', '2026-09-01T10:00:00Z'),
    o('@lev', '2026-08-01T10:00:00Z'),
    o('   ', '2026-07-01T10:00:00Z'),
  ]

  it('merges handles that differ only in case or spaces, newest first', () => {
    expect(knownCustomers(orders)).toEqual([
      { handle: '@Mira', count: 2, last: '2026-10-20T10:00:00Z' },
      { handle: '@lev', count: 1, last: '2026-08-01T10:00:00Z' },
    ])
  })

  it('finds an exact handle, ignoring case and surrounding spaces', () => {
    const customers = knownCustomers(orders)
    expect(findCustomer(customers, ' @MIRA ')?.count).toBe(2)
    expect(findCustomer(customers, '@mir')).toBeUndefined()
    expect(findCustomer(customers, '')).toBeUndefined()
  })
})
