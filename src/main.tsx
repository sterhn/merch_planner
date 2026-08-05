import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { showToast } from './lib/toast'

registerSW()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Single-user app: nothing changes underneath you except your own writes,
      // and those invalidate explicitly. Without this every tab focus refetched
      // all six dashboard tables.
      staleTime: 60_000,
    },
  },
  mutationCache: new MutationCache({
    // Mutations pause while offline and resume on reconnect (TanStack's default
    // networkMode) — say so, instead of leaving the save button silently pending.
    onMutate: () => {
      if (!navigator.onLine) showToast('Offline — this change will save when you reconnect.')
    },
    onError: (error, _variables, _context, mutation) => {
      // Forms that show the failure inline (and stay open) opt out of the toast,
      // so one failure doesn't surface as two differently-worded messages.
      if (mutation.meta?.suppressErrorToast) return
      showToast(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
