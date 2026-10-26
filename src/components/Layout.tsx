import { Outlet, Link, useLocation } from 'react-router-dom'
import { Moon, Sun, BarChart3, GitCompare, Info } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BarChart3 },
    { path: '/compare', label: 'Compare', icon: GitCompare },
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

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
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
        <div className="grid grid-cols-3">
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
