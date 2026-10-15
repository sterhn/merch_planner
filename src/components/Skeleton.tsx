/**
 * Loading placeholders shaped like the content they stand in for, so a list
 * fills in place instead of popping in under a spinner. Only the inner bars
 * pulse — the glass panels stay still, since anything animating a
 * backdrop-filter re-blurs every frame. The pulse stops under reduced motion.
 */

const bar = 'rounded-full bg-ink/10 motion-safe:animate-pulse'

function Bar({ className }: { className: string }) {
  return <span className={`block ${bar} ${className}`} />
}

/** Glass rows: optional thumbnail, two text lines, a value on the right. */
export function SkeletonRows({ rows = 5, thumb = false }: { rows?: number; thumb?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-fade-in items-center gap-3 rounded-card glass p-3.5" style={{ animationDelay: `${i * 50}ms` }}>
          {thumb && <span className={`size-16 shrink-0 rounded-xl bg-ink/10 motion-safe:animate-pulse`} />}
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-3.5 w-3/4" />
            <Bar className="h-2.5 w-1/2" />
          </div>
          <Bar className="h-3.5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Photo-grid cells for the catalog's grid view. */
export function SkeletonGrid({ cells = 6 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="animate-fade-in overflow-hidden rounded-card glass" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="block aspect-square bg-ink/10 motion-safe:animate-pulse" />
          <div className="space-y-2 p-3">
            <Bar className="h-3 w-4/5" />
            <Bar className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The dashboard's frame: hero card, two stat tiles, two cards. */
export function SkeletonDashboard() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-36 animate-fade-in rounded-card bg-brand-strong/25 motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex animate-fade-in items-center gap-3 rounded-card glass p-3.5">
            <span className="size-10 shrink-0 rounded-[38%] bg-ink/10 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-3/4" />
              <Bar className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <SkeletonRows rows={2} />
    </div>
  )
}
