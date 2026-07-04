import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart2, Package, Tag, Printer, ShoppingBag, Wallet, LogOut } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Home', Icon: BarChart2 },
  { to: '/orders', label: 'Orders', Icon: Package },
  { to: '/catalog', label: 'Catalog', Icon: Tag },
  { to: '/collects', label: 'Collects', Icon: Printer },
  { to: '/shelf', label: 'Shelf', Icon: ShoppingBag },
  { to: '/expenses', label: 'Expenses', Icon: Wallet },
]

export default function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar on desktop */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:bg-gradient-to-b md:from-violet-950 md:to-violet-900">
        <div className="px-5 py-5 text-lg font-bold tracking-tight text-violet-200">Merch Planner</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'bg-white/15 font-semibold text-white' : 'text-violet-200 hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-violet-300 transition-colors duration-150 hover:bg-white/10"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-4 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-violet-700' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`rounded-full px-1.5 py-0.5 transition-colors duration-150 ${isActive ? 'bg-violet-100' : ''}`}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
