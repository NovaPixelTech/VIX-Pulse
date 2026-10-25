import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { fuzzySearch, formatNumber, formatPercent } from '@/lib/utils'
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/Skeleton'

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 60
    const y = 20 - ((d - min) / range) * 15
    return `${x},${y}`
  }).join(' ')
  
  const last = data[data.length - 1]
  const color = last >= 0 ? '#22c55e' : '#ef4444'
  
  return (
    <svg width="60" height="24" className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Dashboard() {
  const { data, loading, error } = useData()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'meanChange' | 'maxChange' | 'meanDays' | 'meanVix'>('meanChange')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
      if (e.key === 'Escape') {
        setSearch('')
        document.getElementById('search-input')?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <TableSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg">Error loading data: {error}</p>
      </div>
    )
  }

  const filtered = fuzzySearch(search, data.assets)
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a.summary[sortKey]
    const bVal = b.summary[sortKey]
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  const totalAssets = data.assets.length
  const allValidChanges = data.assets.flatMap(a => a.peaks.filter((p: any) => p.percentChange !== null).map((p: any) => p.percentChange!))
  const meanChangeAll = allValidChanges.length > 0 ? allValidChanges.reduce((a: number, b: number) => a + b, 0) / allValidChanges.length : 0
  const best = [...data.assets].sort((a, b) => b.summary.meanChange - a.summary.meanChange)[0]
  const worst = [...data.assets].sort((a, b) => a.summary.meanChange - b.summary.meanChange)[0]

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
          <span className="text-gradient">VIX</span> Pulse
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Visualizing VIX volatility peaks and subsequent asset performance
        </p>
        
        <div className="relative max-w-md mx-auto mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            id="search-input"
            type="text"
            placeholder="Search by ISIN, ticker, or name... (press /)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm">Tracked Assets</span>
          </div>
          <p className="text-3xl font-bold font-mono">{totalAssets}</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Mean % Change</span>
          </div>
          <p className={`text-3xl font-bold font-mono ${meanChangeAll >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPercent(meanChangeAll)}
          </p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm">Best Performer</span>
          </div>
          <p className="text-lg font-semibold truncate">{best?.ticker}</p>
          <p className="text-2xl font-bold font-mono text-success">{formatPercent(best?.summary.meanChange)}</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-sm">Worst Performer</span>
          </div>
          <p className="text-lg font-semibold truncate">{worst?.ticker}</p>
          <p className="text-2xl font-bold font-mono text-destructive">{formatPercent(worst?.summary.meanChange)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Global Ranking</h2>
        
        <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">ISIN</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('meanChange')}>
                    Mean % Change {sortKey === 'meanChange' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden sm:table-cell" onClick={() => toggleSort('maxChange')}>
                    Max % Change {sortKey === 'maxChange' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => toggleSort('meanDays')}>
                    Mean Days {sortKey === 'meanDays' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => toggleSort('meanVix')}>
                    Mean VIX {sortKey === 'meanVix' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground hidden xl:table-cell">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((asset: any, idx: number) => {
                  const sparkData = asset.peaks.filter((p: any) => p.percentChange !== null).map((p: any) => p.percentChange!)
                  return (
                    <tr
                      key={asset.isin}
                      onClick={() => navigate(`/asset/${asset.isin}`)}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-mono text-muted-foreground">#{idx + 1}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-semibold">{asset.ticker}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{asset.name}</p>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-muted-foreground hidden md:table-cell">{asset.isin}</td>
                      <td className={`p-4 text-right font-mono font-semibold ${asset.summary.meanChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatPercent(asset.summary.meanChange)}
                      </td>
                      <td className={`p-4 text-right font-mono hidden sm:table-cell ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatPercent(asset.summary.maxChange)}
                      </td>
                      <td className="p-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {formatNumber(asset.summary.meanDays, 0)}
                      </td>
                      <td className="p-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {formatNumber(asset.summary.meanVix, 1)}
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        <Sparkline data={sparkData} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
