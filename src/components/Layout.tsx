import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useSignOut } from '../hooks/useAuth'
import { haptic } from '../lib/haptics'
import BrandMark from './BrandMark'
import { SECTIONS } from './sections'
import { TONE_BLOB, type Tone } from './tones'

const NAV = Object.values(SECTIONS)

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
      {/* Sidebar on desktop */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col md:border-r md:border-line md:bg-surface/80 md:backdrop-blur-lg">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-display text-base">Merch Planner</p>
            <p className="text-2xs font-semibold text-ink-faint">your little shop ✿</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
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
        <main key={section} className="mx-auto w-full max-w-4xl flex-1 animate-page-in px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex rounded-t-sheet border-t border-line bg-surface/90 px-1 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-lg md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={() => haptic(5)}
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
