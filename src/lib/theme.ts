// Light / dark / follow the system. Every colour token is a light-dark() pair,
// so pinning `color-scheme` on <html> flips the whole palette; the foil photo
// (index.css) and the browser chrome colour follow `data-theme`. Stored per
// device: a phone and a laptop can sensibly differ.

export type ThemePref = 'system' | 'light' | 'dark'

export const THEME_PREFS: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

const KEY = 'merch:theme'

/** Browser-chrome colours, as in index.html's theme-color metas. */
const CHROME = { light: '#7c3aed', dark: '#17151f' } as const

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readTheme(): ThemePref {
  try {
    const saved = localStorage.getItem(KEY)
    return isThemePref(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') {
    delete root.dataset.theme
    root.style.colorScheme = ''
  } else {
    root.dataset.theme = pref
    root.style.colorScheme = pref
  }
  // index.html has one theme-color per scheme; pinned, both take its colour.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = CHROME[pref === 'system' ? scheme : pref]
  })
}

export function saveTheme(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Private mode: the choice still holds for this visit.
  }
  applyTheme(pref)
}
