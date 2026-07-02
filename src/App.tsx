import { Navigate, Route, Routes } from 'react-router-dom'
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
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-gray-600">
        <div>
          <p className="mb-2 text-2xl">⚙️</p>
          <p className="font-medium">Supabase is not configured.</p>
          <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-gray-400">Loading…</div>
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
