// Latin subsets only: the app and its documents are English (brief §05), and
// latin-ext covers accented names. Fewer files to keep for offline use.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-ext-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-ext-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-ext-600.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-ext-400.css'
import './styles/app.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { Layout, NotFound, RouteError } from './app/Layout.tsx'
import { Archive } from './screens/Archive.tsx'
import { ExpenseBuilder } from './screens/ExpenseBuilder.tsx'
import { ExpenseReport } from './screens/ExpenseReport.tsx'
import { WorkBuilder } from './screens/WorkBuilder.tsx'
import { WorkReport } from './screens/WorkReport.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    // One retry: a server that's down shouldn't be hammered, and the offline
    // fallback (src/data/queries.ts) takes over after the first failure.
    queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false },
  },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/expense" replace /> },
      { path: 'expense', element: <ExpenseBuilder /> },
      { path: 'expense/report', element: <ExpenseReport /> },
      { path: 'work', element: <WorkBuilder /> },
      { path: 'work/report', element: <WorkReport /> },
      { path: 'archive', element: <Archive /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

// Keep the app and the report engine on the device, so reports can be made
// offline (REACH-01). Production builds only — see sw/service-worker.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // No worker (a private window, an old browser): the app still works online.
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
