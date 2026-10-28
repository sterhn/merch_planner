import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CloudOff, DatabaseZap, LogOut } from 'lucide-react'
import { useSignOut } from '../hooks/useAuth'
import { useOnline } from '../hooks/useOnline'
import { SCHEMA_VERSION, useSchemaVersion } from '../hooks/useSettings'
import { haptic } from '../lib/haptics'
import BrandMark from './BrandMark'
import LoadingDots from './LoadingDots'
import ScrollManager from './ScrollManager'
import { INSIGHTS, SECTIONS, SETTINGS } from './sections'
import { TONE_BLOB, type Tone } from './tones'

const NAV = Object.values(SECTIONS)
const SIDEBAR = [...NAV, INSIGHTS, SETTINGS]

/**
 * Migrations are pasted into Supabase by hand, so the code can run ahead of
 * the database. Say so plainly instead of letting a missing column surface as
 * a confusing save error.
 */
function SchemaBanner() {
  const { data: version } = useSchemaVersion()
  if (version === undefined || version >= SCHEMA_VERSION) return null
  return (
    <Link
      to={SETTINGS.to}
      className="glass glass-alert tap mb-4 flex items-center gap-3 rounded-card p-3.5 print:hidden"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[38%] bg-bad/15 text-bad" aria-hidden>
        <DatabaseZap size={19} />
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-bold">Database update needed</span>
        <span className="block text-xs text-ink-muted">
          Run the supabase/migrations files numbered above {String(version).padStart(3, '0')} in the Supabase SQL
          Editor, then reload. Some saves fail until then.
        </span>
      </span>
    </Link>
  )
}

/**
 * The app keeps working offline from cached data (the PWA caches reads, and
 * saves queue until reconnect), so say that's what's on screen.
 */
function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="glass mb-4 flex items-center gap-3 rounded-card p-3 text-sm print:hidden">
      <span className="grid size-9 shrink-0 place-items-center rounded-[38%] bg-sun/40 text-ink" aria-hidden>
        <CloudOff size={17} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold">You’re offline</span>
        <span className="block text-xs text-ink-muted">Showing saved data. Changes save when you reconnect.</span>
      </span>
    </div>
  )
}

/** Tapping the tab you're already on scrolls back to the top, like native apps. */
function scrollTopIfCurrent(to: string, pathname: string) {
  if (to === pathname && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Pill behind the active mobile tab icon. Solid fills pair with their
// `text-on-*` foreground (see CLAUDE.md); sky and peach have no on-* token,
// so they get a tinted blob instead. Labels stay ink — the pastel inks are
// too light for 10px text.
const ACTIVE_PILL: Record<Tone, string> = {
  brand: 'bg-brand text-on-brand',
  accent: 'bg-accent text-on-accent',
  good: 'bg-good text-on-good',
  bad: 'bg-bad text-on-bad',
  sky: 'bg-sky/20 text-sky',
  peach: 'bg-peach/20 text-peach',
  sun: 'bg-sun text-ink',
}

export default function Layout() {
  const signOut = useSignOut()
  const { pathname } = useLocation()
  // Only the top-level section, so opening an order doesn't re-fade the shell.
  const section = pathname.split('/')[1] ?? ''

  return (
    <div className="min-h-dvh md:flex">
      <ScrollManager />
      {/* Sidebar on desktop */}
      <aside className="hidden md:sticky md:top-3 md:m-3 md:flex md:h-[calc(100dvh-1.5rem)] md:w-60 md:shrink-0 md:flex-col md:rounded-sheet md:glass">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-display text-base">Merch Planner</p>
            <p className="text-2xs font-semibold text-ink-faint">your little shop ✿</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {SIDEBAR.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => scrollTopIfCurrent(n.to, pathname)}
              className={({ isActive }) =>
                `group tap flex items-center gap-3 rounded-control px-2.5 py-2 text-sm font-bold ${
                  isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid size-8 place-items-center rounded-[38%] transition-colors ${
                      isActive ? TONE_BLOB[n.tone] : 'group-hover:bg-surface'
                    }`}
                  >
                    <n.icon size={18} strokeWidth={2.2} className={isActive ? 'animate-boing' : 'group-hover:animate-wiggle'} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => void signOut()}
          className="tap m-3 flex items-center gap-3 rounded-control px-2.5 py-2 text-left text-sm font-semibold text-ink-muted hover:bg-surface-2"
        >
          <span className="grid size-8 place-items-center">
            <LogOut size={18} />
          </span>
          Sign out
        </button>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main key={section} className="mx-auto w-full max-w-4xl flex-1 animate-page-in px-4 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+2rem)] pt-5 md:px-6 md:pb-10 md:pt-8">
          <OfflineBanner />
          <SchemaBanner />
          {/* Pages are lazy-loaded (App.tsx); the nav stays put while one arrives. */}
          <Suspense fallback={<LoadingDots />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Floating glass tab bar on mobile. Sits --spacing-nav tall, lifted 0.5rem
          above the safe area — the Toast offsets by the same sum. */}
      <nav className="glass fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-20 flex rounded-sheet px-1 [--glass-fill:72%] md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={() => {
              haptic(5)
              scrollTopIfCurrent(n.to, pathname)
            }}
            className="tap flex min-h-nav flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-1 transition-colors duration-200 ${
                    isActive ? `${ACTIVE_PILL[n.tone]} animate-boing shadow-card` : 'text-ink-faint'
                  }`}
                >
                  <n.icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span className={`text-3xs font-bold ${isActive ? 'text-ink' : 'text-ink-faint'}`}>
                  {n.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
