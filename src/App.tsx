import { lazy } from 'react'
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
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Collects = lazy(() => import('./pages/Collects'))
const Expenses = lazy(() => import('./pages/Expenses'))
const SettingsPage = lazy(() => import('./pages/Settings'))

export default function App() {
  const { session, loading } = useAuth()

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
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="collects" element={<Collects />} />
          {/* The consignment-shelf page is archived — restore src/pages/Shelf.tsx
              from git history if the shelf ever comes back (see CLAUDE.md). */}
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toast />
    </>
  )
}
