import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Search, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn, formatCurrency, formatDate, formatNumber, formatPercent, fuzzySearch } from '@/lib/utils'
import { getWeeklyStats } from '@/lib/vix'
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/Skeleton'
import VixOverview from '@/components/VixOverview'
import type { Asset } from '@/types'
import { getAssetVixResponse } from '@/lib/vixResponse'

type SortKey = 'meanChange' | 'maxChange' | 'meanDays' | 'meanVix'

function createCustomAsset(
  ticker: string,
  name: string,
  isin: string,
  type: 'stock' | 'etf' | 'etc' | 'adr' | 'index',
  currency: string,
  exchange: string,
  priceHistory: number[],
  vixHistory: number[],
): Asset {
  const dates: string[] = []
  const baseDate = new Date()
  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() - i * 7)
    const day = d.getDay()
    const diff = day === 5 ? 0 : day < 5 ? 5 - day : 5 - day + 7
    d.setDate(d.getDate() + diff)
    dates.push(d.toISOString().split('T')[0])
  }
  const priceSeries = {
    dates,
    vix: vixHistory.slice(-dates.length),
    price: priceHistory.slice(-dates.length),
    frequency: 'weekly' as const,
  }
  const response = getAssetVixResponse(
    {
      isin,
      ticker,
      name,
      type,
      currency,
      exchange,
      peaks: [],
      summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
      priceSeries,
    } as Asset,
    25,
    20,
    false,
  )
  const peaks = response.events.map((ev) => ({
    vixPeakDate: ev.peakDate,
    vixPeakValue: ev.peakVix,
    assetPriceAtPeak: ev.peakPrice,
    vixRecoveryDate: ev.recoveryDate,
    assetPriceAtRecovery: ev.recoveryPrice,
    percentChange: ev.reboundPct,
    daysToRecovery: ev.daysToVixRecovery,
  }))
  const validPeaks = peaks.filter((p) => p.percentChange !== null)
  const summary =
    validPeaks.length === 0
      ? { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 }
      : {
          meanChange: Number(
            (validPeaks.reduce((sum, p) => sum + (p.percentChange || 0), 0) / validPeaks.length).toFixed(2),
          ),
          maxChange: Number(Math.max(...validPeaks.map((p) => p.percentChange || 0)).toFixed(2)),
          meanDays: Number(
            (validPeaks.reduce((sum, p) => sum + (p.daysToRecovery || 0), 0) / validPeaks.length).toFixed(1),
          ),
          meanVix: Number((peaks.reduce((sum, p) => sum + p.vixPeakValue, 0) / peaks.length).toFixed(2)),
        }
  const latestPrice = priceSeries.price[priceSeries.price.length - 1]
  const prevPrice = priceSeries.price[priceSeries.price.length - 2]
  return {
    isin: isin || `${ticker.toUpperCase()}-CUSTOM`,
    ticker: ticker.toUpperCase(),
    name: name || ticker.toUpperCase(),
    type,
    currency,
    exchange,
    peaks,
    summary,
    latestQuote:
      typeof latestPrice === 'number'
        ? {
            price: latestPrice,
            date: dates[dates.length - 1],
            previousPrice: typeof prevPrice === 'number' ? prevPrice : null,
            previousDate: typeof prevPrice === 'number' ? dates[dates.length - 2] : null,
            changeAbs: typeof prevPrice === 'number' ? latestPrice - prevPrice : null,
            changePct: typeof prevPrice === 'number' ? ((latestPrice - prevPrice) / prevPrice) * 100 : null,
          }
        : null,
    priceSeries,
  } as Asset
}

function SortHeader({
  label,
  column,
  sortKey,
  sortAsc,
  onSort,
  className,
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sortKey === column
  return (
    <th
      className={cn('p-4 text-right', className)}
      aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {label}
        <span aria-hidden="true">{active ? (sortAsc ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 60
      const y = 20 - ((d - min) / range) * 15
      return `${x},${y}`
    })
    .join(' ')

  const last = data[data.length - 1]
  const color = last >= 0 ? '#22c55e' : '#ef4444'

  return (
    <svg width="60" height="24" className="inline-block" aria-hidden="true">
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
  const { data, loading, error, addCustomAsset } = useData()
  const navigate = useNavigate()
  usePageTitle()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('meanChange')
  const [sortAsc, setSortAsc] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    ticker: '',
    name: '',
    isin: '',
    type: 'stock' as 'stock' | 'etf' | 'etc' | 'adr' | 'index',
    currency: 'USD',
    exchange: 'NASDAQ',
    prices: '',
    vix: '',
  })

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
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
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
  const compareAssets = (a: Asset, b: Asset) => {
    const aVal = a.summary[sortKey]
    const bVal = b.summary[sortKey]
    return sortAsc ? aVal - bVal : bVal - aVal
  }
  const sorted = [...filtered].sort(compareAssets)
  const navigationOrder = [...data.assets].sort(compareAssets).map((asset) => asset.isin)
  const openAsset = (asset: Asset) =>
    navigate(`/asset/${asset.isin}`, { state: { assetOrder: navigationOrder } })

  const totalAssets = data.assets.length
  const allValidChanges = data.assets.flatMap((asset) =>
    asset.peaks.flatMap((peak) => (peak.percentChange === null ? [] : [peak.percentChange])),
  )
  const meanChangeAll =
    allValidChanges.length > 0 ? allValidChanges.reduce((a, b) => a + b, 0) / allValidChanges.length : 0
  const best = [...data.assets].sort((a, b) => b.summary.meanChange - a.summary.meanChange)[0]
  const worst = [...data.assets].sort((a, b) => a.summary.meanChange - b.summary.meanChange)[0]

  const toggleSort = (key: SortKey) => {
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
          Visualizing VIX volatility peaks and subsequent asset performance · weekly data through{' '}
          <span className="font-medium text-foreground">{formatDate(data.dateRange.to)}</span>
        </p>

        <div className="relative max-w-md mx-auto mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            id="search-input"
            type="text"
            placeholder="Search by ISIN, ticker, or name... (press /)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search assets by ISIN, ticker, or name"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Add custom asset (ticker/ISIN + history)
          </button>
        </div>
        {showAdd && (
          <div className="max-w-2xl mx-auto mt-4 rounded-xl border border-border bg-card p-4 text-left space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={addForm.ticker}
                onChange={(e) => setAddForm((f) => ({ ...f, ticker: e.target.value }))}
                placeholder="Ticker (e.g., TSLA)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={addForm.isin}
                onChange={(e) => setAddForm((f) => ({ ...f, isin: e.target.value }))}
                placeholder="ISIN (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={addForm.type}
                onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as any }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="stock">stock</option>
                <option value="etf">etf</option>
                <option value="etc">etc</option>
                <option value="adr">adr</option>
                <option value="index">index</option>
              </select>
              <input
                value={addForm.currency}
                onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="Currency (USD)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={addForm.exchange}
                onChange={(e) => setAddForm((f) => ({ ...f, exchange: e.target.value }))}
                placeholder="Exchange"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Weekly prices (comma separated), oldest to newest or newest to oldest - will be aligned
              </p>
              <textarea
                value={addForm.prices}
                onChange={(e) => setAddForm((f) => ({ ...f, prices: e.target.value }))}
                placeholder="100, 102, 98, ..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                rows={3}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Weekly VIX (comma separated)</p>
              <textarea
                value={addForm.vix}
                onChange={(e) => setAddForm((f) => ({ ...f, vix: e.target.value }))}
                placeholder="18, 19, 25, ..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const parseNums = (s: string) =>
                      s
                        .split(/[\s,;]+/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .map((x) => Number(x))
                        .filter((n) => !isNaN(n))
                    const prices = parseNums(addForm.prices)
                    const vix = parseNums(addForm.vix)
                    if (prices.length === 0) {
                      alert('Please provide at least some prices')
                      return
                    }
                    const asset = createCustomAsset(
                      addForm.ticker || 'CUSTOM',
                      addForm.name || addForm.ticker || 'Custom Asset',
                      addForm.isin,
                      addForm.type,
                      addForm.currency || 'USD',
                      addForm.exchange || 'CUSTOM',
                      prices,
                      vix.length ? vix : Array(prices.length).fill(18),
                    )
                    addCustomAsset(asset)
                    setShowAdd(false)
                    setAddForm({
                      ticker: '',
                      name: '',
                      isin: '',
                      type: 'stock',
                      currency: 'USD',
                      exchange: 'NASDAQ',
                      prices: '',
                      vix: '',
                    })
                  } catch (e) {
                    alert('Failed to add asset')
                  }
                }}
                className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm"
              >
                Add Asset
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Custom assets are stored locally in your browser. They will appear in search/ranking and
              analysis.
            </p>
          </div>
        )}
      </div>

      <VixOverview data={data} />

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
          <p
            className={`text-3xl font-bold font-mono ${meanChangeAll >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            {formatPercent(meanChangeAll)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm">Best Performer</span>
          </div>
          <p className="text-lg font-semibold truncate">{best?.ticker}</p>
          <p className="text-2xl font-bold font-mono text-success">
            {formatPercent(best?.summary.meanChange)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-sm">Worst Performer</span>
          </div>
          <p className="text-lg font-semibold truncate">{worst?.ticker}</p>
          <p className="text-2xl font-bold font-mono text-destructive">
            {formatPercent(worst?.summary.meanChange)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-bold">Global Ranking</h2>
          <p className="text-sm text-muted-foreground">
            {sorted.length} assets · weekly prices through {formatDate(data.dateRange.to)}
          </p>
        </div>

        {sorted.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No assets match “{search}”.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
            >
              Clear search
            </button>
          </div>
        )}

        <div
          className={cn(
            'rounded-xl border border-border bg-card overflow-hidden card-glow',
            sorted.length === 0 ? 'hidden' : 'hidden sm:block',
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1230px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">
                    ISIN
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    Latest Price
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    1D
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    Last Week
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    1W
                  </th>
                  <SortHeader
                    label="Mean % Change"
                    column="meanChange"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Max % Change"
                    column="maxChange"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={toggleSort}
                    className="hidden sm:table-cell"
                  />
                  <SortHeader
                    label="Mean Days"
                    column="meanDays"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={toggleSort}
                    className="hidden lg:table-cell"
                  />
                  <SortHeader
                    label="Mean VIX"
                    column="meanVix"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={toggleSort}
                    className="hidden lg:table-cell"
                  />
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground hidden 2xl:table-cell">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((asset, idx) => {
                  const sparkData = asset.peaks
                    .filter((p) => p.percentChange !== null)
                    .map((p) => p.percentChange!)
                  const weekly = getWeeklyStats(asset)
                  const latestQuote = asset.latestQuote
                  return (
                    <tr
                      key={asset.isin}
                      onClick={() => openAsset(asset)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openAsset(asset)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`View ${asset.ticker}, ${asset.name}`}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors focus:outline-none focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <td className="p-4 font-mono text-muted-foreground">#{idx + 1}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-semibold">{asset.ticker}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{asset.name}</p>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-muted-foreground hidden md:table-cell">
                        {asset.isin}
                      </td>
                      <td className="p-4 text-right font-mono hidden sm:table-cell">
                        {formatCurrency(latestQuote?.price ?? weekly.latest, asset.currency)}
                        <span className="block text-xs text-muted-foreground">
                          {latestQuote?.date ? formatDate(latestQuote.date) : 'weekly fallback'}
                        </span>
                      </td>
                      <td
                        className={`p-4 text-right font-mono hidden lg:table-cell ${
                          latestQuote?.changePct === null || latestQuote?.changePct === undefined
                            ? 'text-muted-foreground'
                            : latestQuote.changePct >= 0
                              ? 'text-success'
                              : 'text-destructive'
                        }`}
                      >
                        {formatPercent(latestQuote?.changePct)}
                      </td>
                      <td className="p-4 text-right font-mono text-muted-foreground hidden sm:table-cell">
                        {formatCurrency(weekly.latest, asset.currency)}
                      </td>
                      <td
                        className={`p-4 text-right font-mono hidden sm:table-cell ${
                          weekly.changePct === null
                            ? 'text-muted-foreground'
                            : weekly.changePct >= 0
                              ? 'text-success'
                              : 'text-destructive'
                        }`}
                      >
                        {formatPercent(weekly.changePct)}
                      </td>
                      <td
                        className={`p-4 text-right font-mono font-semibold ${asset.summary.meanChange >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {formatPercent(asset.summary.meanChange)}
                      </td>
                      <td
                        className={`p-4 text-right font-mono hidden sm:table-cell ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {formatPercent(asset.summary.maxChange)}
                      </td>
                      <td className="p-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {formatNumber(asset.summary.meanDays, 0)}
                      </td>
                      <td className="p-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {formatNumber(asset.summary.meanVix, 1)}
                      </td>
                      <td className="p-4 hidden 2xl:table-cell">
                        <Sparkline data={sparkData} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cn('space-y-3 sm:hidden', sorted.length === 0 && 'hidden')}>
          {sorted.map((asset, idx) => {
            const weekly = getWeeklyStats(asset)
            const latestQuote = asset.latestQuote
            return (
              <button
                key={asset.isin}
                onClick={() => openAsset(asset)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left card-glow transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                      <span className="font-semibold">{asset.ticker}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{asset.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{asset.isin}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-mono text-lg font-bold ${asset.summary.meanChange >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {formatPercent(asset.summary.meanChange)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">mean change</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/70 pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Latest price</p>
                    <p className="font-mono">
                      {formatCurrency(latestQuote?.price ?? weekly.latest, asset.currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {latestQuote?.date ? formatDate(latestQuote.date) : 'weekly fallback'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">1D</p>
                    <p
                      className={`font-mono ${
                        latestQuote?.changePct === null || latestQuote?.changePct === undefined
                          ? 'text-muted-foreground'
                          : latestQuote.changePct >= 0
                            ? 'text-success'
                            : 'text-destructive'
                      }`}
                    >
                      {formatPercent(latestQuote?.changePct)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last week</p>
                    <p className="font-mono">{formatCurrency(weekly.latest, asset.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">1W</p>
                    <p
                      className={`font-mono ${
                        weekly.changePct === null
                          ? 'text-muted-foreground'
                          : weekly.changePct >= 0
                            ? 'text-success'
                            : 'text-destructive'
                      }`}
                    >
                      {formatPercent(weekly.changePct)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mean VIX</p>
                    <p className="font-mono">{formatNumber(asset.summary.meanVix, 1)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
