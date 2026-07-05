import { Navigate, Route, Routes } from 'react-router-dom'
import { Settings, Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { supabaseConfigured } from './lib/supabase'
import Layout from './components/Layout'
import Toast from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Catalog from './pages/Catalog'
import Collects from './pages/Collects'
import Shelf from './pages/Shelf'
import Expenses from './pages/Expenses'

export default function App() {
  const { session, loading } = useAuth()

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-ink-muted">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15">
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
      <div className="flex min-h-dvh items-center justify-center text-ink-faint">
        <Loader2 size={28} className="animate-spin" />
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
          <Route path="shelf" element={<Shelf />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toast />
    </>
  )
}
