/** Three bouncing dots — the app's loading indicator. */
export default function LoadingDots({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-12">
      <div className="flex gap-1.5" aria-hidden>
        {['bg-brand', 'bg-brand-2', 'bg-accent'].map((c, i) => (
          <span key={c} className={`size-2.5 animate-dot rounded-full ${c}`} style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
      <p className="text-sm font-semibold text-ink-faint">{label}</p>
    </div>
  )
}
