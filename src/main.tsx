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
    onError: (error) => {
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
