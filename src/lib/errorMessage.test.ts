import { describe, expect, it } from 'vitest'
import { errorMessage, failureMessage } from './errorMessage'

describe('errorMessage', () => {
  it('surfaces a PostgREST error with its code', () => {
    // The real payload that made "can't save the collect" undiagnosable.
    expect(
      errorMessage({
        code: 'PGRST204',
        details: null,
        hint: null,
        message: "Could not find the 'print_cost' column of 'collect_items' in the schema cache",
      }),
    ).toBe("Could not find the 'print_cost' column of 'collect_items' in the schema cache (PGRST204)")
  })

  it('joins details and hint when Postgres supplies them', () => {
    expect(
      errorMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: 'Key (sku)=(ABC) already exists.',
        hint: null,
      }),
    ).toBe('duplicate key value violates unique constraint — Key (sku)=(ABC) already exists. (23505)')
  })

  it('omits the code when there is not one', () => {
    expect(errorMessage({ message: 'boom' })).toBe('boom')
  })

  it('handles plain Errors and strings', () => {
    expect(errorMessage(new Error('network down'))).toBe('network down')
    expect(errorMessage('something')).toBe('something')
  })

  it('never returns an empty string', () => {
    expect(errorMessage(null)).toBe('Unknown error')
    expect(errorMessage(undefined)).toBe('Unknown error')
    expect(errorMessage({})).toBe('Unknown error')
    expect(errorMessage(new Error(''))).toBe('Unknown error')
  })
})

describe('failureMessage', () => {
  it('names the action that failed', () => {
    expect(failureMessage('Save', { message: 'nope', code: 'X' })).toBe('Save failed: nope (X)')
  })
})
