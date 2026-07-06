import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', label: 'Home', icon: '📊' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/catalog', label: 'Catalog', icon: '🏷️' },
  { to: '/collects', label: 'Collects', icon: '🖨️' },
  { to: '/shelf', label: 'Shelf', icon: '🛍️' },
  { to: '/expenses', label: 'Expenses', icon: '💸' },
]

export default function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar on desktop */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-gray-200 md:bg-white">
        <div className="px-5 py-5 text-lg font-bold text-violet-700">Merch Planner</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-violet-100 text-violet-800' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="m-3 rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
        >
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
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className="relative flex flex-1 flex-col items-center justify-center pt-2 pb-1 min-h-[52px]"
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {n.icon}
                </span>
                <span className={`mt-0.5 text-[10px] font-semibold ${isActive ? 'text-violet-700' : 'text-gray-400'}`}>
                  {n.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-violet-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
