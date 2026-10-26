import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { DataProvider } from './hooks/useData'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'

const AssetDetail = lazy(() => import('./pages/AssetDetail'))
const Compare = lazy(() => import('./pages/Compare'))
const About = lazy(() => import('./pages/About'))

function RouteFallback() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-6 w-96 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-96 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route
                path="asset/:isin"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AssetDetail />
                  </Suspense>
                }
              />
              <Route
                path="compare"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Compare />
                  </Suspense>
                }
              />
              <Route
                path="about"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <About />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </ThemeProvider>
  )
}

export default App
