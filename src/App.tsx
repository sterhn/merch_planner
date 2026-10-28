import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Settings } from 'lucide-react'
import BrandMark from './components/BrandMark'
import LoadingDots from './components/LoadingDots'
import { useAuth } from './hooks/useAuth'
import { supabaseConfigured } from './lib/supabase'
import Layout from './components/Layout'
import Toast from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// The dashboard is the first screen, so it ships in the main bundle; every
// other page loads on first visit (and is precached by the PWA, so offline
// still works). Layout's <Suspense> covers the moment one is fetching.
const PAGES = {
  orders: () => import('./pages/Orders'),
  orderDetail: () => import('./pages/OrderDetail'),
  packing: () => import('./pages/Packing'),
  catalog: () => import('./pages/Catalog'),
  collects: () => import('./pages/Collects'),
  expenses: () => import('./pages/Expenses'),
  settings: () => import('./pages/Settings'),
  insights: () => import('./pages/Insights'),
}
const Orders = lazy(PAGES.orders)
const OrderDetail = lazy(PAGES.orderDetail)
const Packing = lazy(PAGES.packing)
const Catalog = lazy(PAGES.catalog)
const Collects = lazy(PAGES.collects)
const Expenses = lazy(PAGES.expenses)
const SettingsPage = lazy(PAGES.settings)
const Insights = lazy(PAGES.insights)

/**
 * Once the dashboard is up and the browser is idle, load the other pages in
 * the background, so the first tap on a tab opens it straight away instead of
 * flashing the loading dots while its chunk downloads and parses.
 */
function usePreloadPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const load = () => Object.values(PAGES).forEach((page) => void page().catch(() => {}))
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(load, { timeout: 4000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(load, 1500)
    return () => clearTimeout(id)
  }, [enabled])
}

export default function App() {
  const { session, loading } = useAuth()
  usePreloadPages(Boolean(session))

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-ink-muted">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand/10">
            <Settings size={28} className="text-brand" />
          </span>
          <p className="font-bold">Supabase is not configured.</p>
          <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center">
        <span className="animate-float">
          <BrandMark size={56} />
        </span>
        <LoadingDots label="Opening your shop…" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/pack" element={<Packing />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="collects" element={<Collects />} />
          {/* The consignment-shelf page is archived — restore src/pages/Shelf.tsx
              from git history if the shelf ever comes back (see CLAUDE.md). */}
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="insights" element={<Insights />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toast />
    </>
  )
}
