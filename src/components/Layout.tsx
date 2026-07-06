import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  Printer,
  Store,
  Wallet,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { haptic } from '../lib/haptics'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/catalog', label: 'Catalog', icon: Tags },
  { to: '/collects', label: 'Collects', icon: Printer },
  { to: '/shelf', label: 'Shelf', icon: Store },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
]

export default function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar on desktop */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-line md:bg-surface">
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text px-5 py-5 font-display text-base font-bold text-transparent">
          Merch Planner
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `tap flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-bold ${
                  isActive ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-surface-2'
                }`
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="tap m-3 flex items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-medium text-ink-muted hover:bg-surface-2"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-4 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex rounded-t-sheet border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgb(0_0_0/0.15)] backdrop-blur-lg md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={() => haptic(5)}
            className="tap flex min-h-16 flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-1 transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-card'
                      : 'text-ink-faint'
                  }`}
                >
                  <n.icon size={19} />
                </span>
                <span className={`text-[10px] font-bold ${isActive ? 'text-brand' : 'text-ink-faint'}`}>
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
