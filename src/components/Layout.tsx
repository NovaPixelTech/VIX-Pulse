import { Outlet, Link, useLocation } from 'react-router-dom'
import { Moon, Sun, Activity, BarChart3, GitCompare, Info, RefreshCw } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { useTheme } from '@/hooks/useTheme'

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { data, loading, refreshing, refreshError, refreshData } = useData()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BarChart3 },
    { path: '/compare', label: 'Compare', icon: GitCompare },
    { path: '/response', label: 'Response', icon: Activity },
    { path: '/about', label: 'About', icon: Info },
  ]

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/' || location.pathname.startsWith('/asset/')
      : location.pathname === path

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative">
                <BarChart3 className="h-6 w-6 text-primary" />
                <div className="absolute -inset-1 bg-primary/20 blur-lg group-hover:bg-primary/30 transition-all" />
              </div>
              <span className="text-xl font-bold">
                <span className="text-gradient">VIX</span> Pulse
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={loading || refreshing}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-wait disabled:opacity-60 sm:px-3"
                aria-label={refreshing ? 'Refreshing published market data' : 'Refresh published market data'}
                title="Reload the latest published VIX and asset quote snapshot"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
        <div className="sr-only" role="status" aria-live="polite">
          {refreshing
            ? 'Refreshing the latest published market data snapshot.'
            : data
              ? `Market data snapshot generated ${data.generatedAt}.`
              : ''}
        </div>
        {refreshError && (
          <div
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Could not refresh the published data snapshot ({refreshError}). The last loaded data remains
            visible.
          </div>
        )}
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="container mx-auto px-4 py-6 pb-24 text-center text-sm text-muted-foreground sm:px-6 md:pb-6 lg:px-8">
          <p>VIX Pulse • For research only. Not investment advice.</p>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        aria-label="Primary navigation"
      >
        <div className="grid grid-cols-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
