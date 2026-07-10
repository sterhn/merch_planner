// The PWA manifest's share_target opens the app at /merch_planner/?title=…&text=…&url=…
// (query before the hash route). Capture it once at startup, then scrub the
// address bar so a refresh doesn't re-trigger the share.

const params = new URLSearchParams(window.location.search)
let pending =
  [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join('\n') || null

if (pending) {
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

/** Returns the shared text once; later calls (e.g. StrictMode re-mounts) get null. */
export function takeSharedText(): string | null {
  const text = pending
  pending = null
  return text
}
