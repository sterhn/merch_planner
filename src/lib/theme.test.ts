import { describe, expect, it } from 'vitest'
import { isThemePref, readTheme } from './theme'

describe('theme preference', () => {
  it('accepts only the three known values', () => {
    expect(['system', 'light', 'dark'].every(isThemePref)).toBe(true)
    expect(isThemePref('sepia')).toBe(false)
    expect(isThemePref(null)).toBe(false)
  })

  it('falls back to the system theme when storage is unavailable', () => {
    // No localStorage under Node: reading must not throw.
    expect(readTheme()).toBe('system')
  })
})
