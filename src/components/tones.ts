/**
 * Colour families for icon blobs and section identity. Each pairs a tinted
 * background with an icon ink that clears 3:1 on it in both themes.
 * `sun` is too pale to be ink, so its glyph uses the regular ink colour.
 */
export type Tone = 'brand' | 'accent' | 'good' | 'bad' | 'sky' | 'peach' | 'sun'

export const TONE_BLOB: Record<Tone, string> = {
  brand: 'bg-brand/15 text-brand',
  accent: 'bg-accent/15 text-accent',
  good: 'bg-good/15 text-good',
  bad: 'bg-bad/15 text-bad',
  sky: 'bg-sky/15 text-sky',
  peach: 'bg-peach/15 text-peach',
  sun: 'bg-sun/50 text-ink',
}

export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand',
  accent: 'text-accent',
  good: 'text-good',
  bad: 'text-bad',
  sky: 'text-sky',
  peach: 'text-peach',
  sun: 'text-ink',
}
