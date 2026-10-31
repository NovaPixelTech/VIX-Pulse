import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, RefreshCw, Search, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn, formatCurrency, formatDate, formatNumber, formatPercent, fuzzySearch } from '@/lib/utils'
import { getWeeklyStats } from '@/lib/vix'
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/Skeleton'
import VixOverview from '@/components/VixOverview'
import type { Asset } from '@/types'
import { createCustomAssetFromCsv, createCustomAssetFromPrices } from '@/lib/customAssets'
import {
  getTwelveDataApiKey,
  saveTwelveDataApiKey,
  searchTwelveDataInstruments,
  fetchTwelveDataDailyPrices,
  type TwelveDataInstrument,
} from '@/lib/twelveData'

type SortKey = 'meanChange' | 'maxChange' | 'meanDays' | 'meanVix'

function getAssetType(instrumentType: string): Asset['type'] {
  const type = instrumentType.toLowerCase()
  if (type.includes('etf')) return 'etf'
  if (type.includes('adr') || type.includes('depositary')) return 'adr'
  if (type.includes('index')) return 'index'
  if (type.includes('commodity') || type.includes('etc')) return 'etc'
  return 'stock'
}

function looksLikeIsin(value: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(value.trim())
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
  const {
    data,
    loading,
    error,
    addCustomAsset,
    removeCustomAsset,
    customAssets,
    refreshCustomAssets,
    refreshingCustomAssets,
    customAssetRefreshError,
  } = useData()
  const navigate = useNavigate()
  usePageTitle()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('meanChange')
  const [sortAsc, setSortAsc] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState(() => getTwelveDataApiKey())
  const [providerQuery, setProviderQuery] = useState('')
  const [providerResults, setProviderResults] = useState<TwelveDataInstrument[]>([])
  const [providerBusy, setProviderBusy] = useState(false)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [providerNotice, setProviderNotice] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({
    ticker: '',
    name: '',
    isin: '',
    type: 'stock' as 'stock' | 'etf' | 'etc' | 'adr' | 'index',
    currency: 'USD',
    exchange: 'NASDAQ',
    priceCsv: '',
  })

  const handleProviderSearch = async () => {
    const query = providerQuery.trim()
    if (!query) {
      setProviderError('Enter a ticker, company name, or ISIN to search.')
      return
    }
    if (!apiKeyInput.trim() || getTwelveDataApiKey() !== apiKeyInput.trim()) {
      setProviderError('Save your Twelve Data API key locally before searching.')
      return
    }
    setProviderBusy(true)
    setProviderError(null)
    setProviderNotice(null)
    setProviderResults([])
    try {
      const results = await searchTwelveDataInstruments(query, apiKeyInput)
      setProviderResults(results)
      if (results.length === 0) {
        setProviderError(
          looksLikeIsin(query)
            ? 'No matching instrument was found. ISIN search may require enabling Twelve Data’s ISIN add-on.'
            : 'No matching instruments were found. Check the search text and try again.',
        )
      }
    } catch (cause) {
      setProviderError(cause instanceof Error ? cause.message : 'Could not search Twelve Data.')
    } finally {
      setProviderBusy(false)
    }
  }

  const handleAddProviderAsset = async (instrument: TwelveDataInstrument) => {
    if (!data?.dailyVix || !data.dailyVix.dates[0]) {
      setProviderError('The shared daily VIX calendar is unavailable, so this asset cannot be analyzed yet.')
      return
    }
    if (!apiKeyInput.trim() || getTwelveDataApiKey() !== apiKeyInput.trim()) {
      setProviderError('Save your Twelve Data API key locally before fetching prices.')
      return
    }
    setProviderBusy(true)
    setProviderError(null)
    setProviderNotice(null)
    try {
      const reference = data.assets.find((item) => !item.customDataSource && !item.placeholder)
      if (!reference) throw new Error('Published reference price data is unavailable for this asset.')
      const series = await fetchTwelveDataDailyPrices(
        instrument,
        apiKeyInput,
        data.dailyVix.dates[0],
        new Date().toISOString().slice(0, 10),
      )
      const suppliedIsin = instrument.isin || (looksLikeIsin(providerQuery) ? providerQuery.trim() : '')
      const asset = createCustomAssetFromPrices(
        {
          ticker: instrument.symbol,
          name: instrument.instrument_name,
          isin: suppliedIsin,
          type: getAssetType(instrument.instrument_type),
          currency: series.instrument.currency,
          exchange: series.instrument.exchange,
        },
        series.prices,
        data.dailyVix,
        reference,
      )
      asset.customDataSource = 'Twelve Data'
      asset.customProviderSymbol = series.instrument.symbol
      asset.customLastFetchedAt = new Date().toISOString()
      addCustomAsset(asset)
      setProviderNotice(`${asset.ticker} was added and its price history is saved in this browser.`)
      setProviderResults((results) => results.filter((result) => result.symbol !== instrument.symbol))
    } catch (cause) {
      setProviderError(cause instanceof Error ? cause.message : 'Could not download the asset history.')
    } finally {
      setProviderBusy(false)
    }
  }

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
            onClick={() => {
              setShowAdd((visible) => !visible)
              setAddError(null)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Add or manage local assets
          </button>
        </div>
        {showAdd && (
          <div className="max-w-2xl mx-auto mt-4 rounded-xl border border-border bg-card p-4 text-left space-y-3">
            <div>
              <h2 className="font-semibold">Add an asset to this browser</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Search by ticker, company name, or ISIN to find an instrument and download its daily history.
                Or import a CSV manually below.
              </p>
            </div>

            <section
              className="space-y-3 rounded-lg border border-border p-3"
              aria-label="Online asset lookup"
            >
              <div>
                <h3 className="text-sm font-semibold">Online lookup · Twelve Data</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use your own Twelve Data API key. It is stored in this browser only and sent directly to the
                  provider; it is not uploaded to VIX Pulse.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(event) => {
                    setApiKeyInput(event.target.value)
                    setProviderResults([])
                    setProviderError(null)
                  }}
                  aria-label="Twelve Data API key"
                  placeholder="Twelve Data API key"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      saveTwelveDataApiKey(apiKeyInput)
                      setProviderError(null)
                      setProviderNotice(
                        apiKeyInput.trim()
                          ? 'API key saved in this browser.'
                          : 'Saved API key removed from this browser.',
                      )
                      if (apiKeyInput.trim()) void refreshCustomAssets(false)
                    } catch (cause) {
                      setProviderError(cause instanceof Error ? cause.message : 'Could not save the API key.')
                    }
                  }}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  Save key locally
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={providerQuery}
                  disabled={providerBusy}
                  onChange={(event) => {
                    setProviderQuery(event.target.value)
                    setProviderResults([])
                    setProviderError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleProviderSearch()
                  }}
                  aria-label="Search ticker, asset name, or ISIN online"
                  placeholder="Ticker, asset name, or ISIN"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleProviderSearch()}
                  disabled={providerBusy}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  {providerBusy ? 'Working…' : 'Search online'}
                </button>
              </div>
              {providerResults.length > 0 && (
                <div className="space-y-2" aria-label="Online search results">
                  {providerResults.map((instrument) => (
                    <div
                      key={`${instrument.symbol}-${instrument.exchange}`}
                      className="flex flex-col justify-between gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {instrument.instrument_name}{' '}
                          <span className="text-muted-foreground">({instrument.symbol})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            instrument.exchange,
                            instrument.country,
                            instrument.currency,
                            instrument.instrument_type,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAddProviderAsset(instrument)}
                        disabled={providerBusy}
                        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                      >
                        {providerBusy ? 'Fetching…' : 'Fetch & add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {providerError && (
                <p className="text-sm text-destructive" role="alert">
                  {providerError}
                </p>
              )}
              {providerNotice && (
                <p className="text-sm text-success" role="status">
                  {providerNotice}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ISIN search may require the provider&apos;s ISIN add-on. Online prices are sourced from Twelve
                Data and may differ from the Yahoo Finance history used for built-in assets. When this app is
                opened, online assets refresh at most once per 24 hours; use the refresh button below to
                update now.
              </p>
            </section>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <span className="text-sm font-medium">Manual CSV import</span>
              <span className="text-xs text-muted-foreground">(no API key required)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={addForm.ticker}
                onChange={(e) => setAddForm((f) => ({ ...f, ticker: e.target.value }))}
                aria-label="Ticker or display identifier"
                placeholder="Ticker / display identifier (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                aria-label="Asset name"
                placeholder="Asset name"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={addForm.isin}
                onChange={(e) => setAddForm((f) => ({ ...f, isin: e.target.value }))}
                aria-label="ISIN"
                placeholder="ISIN (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={addForm.type}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    type: e.target.value as 'stock' | 'etf' | 'etc' | 'adr' | 'index',
                  }))
                }
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
              <label htmlFor="custom-asset-csv" className="mb-1 block text-xs text-muted-foreground">
                Daily price CSV with Date and Adj Close/Close columns (Yahoo Finance export supported)
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Import daily price CSV"
                onChange={async (event) => {
                  const input = event.currentTarget
                  const file = input.files?.[0]
                  if (!file) return
                  try {
                    const priceCsv = await file.text()
                    setAddForm((form) => ({ ...form, priceCsv }))
                    setAddError(null)
                  } catch {
                    setAddError('Could not read that file. Paste the CSV text below instead.')
                  } finally {
                    input.value = ''
                  }
                }}
                className="mb-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
              />
              <textarea
                id="custom-asset-csv"
                value={addForm.priceCsv}
                onChange={(e) => setAddForm((f) => ({ ...f, priceCsv: e.target.value }))}
                placeholder={'Date,Close\n2025-09-01,100.00\n2025-09-02,102.50'}
                aria-label="Daily dated closing-price CSV"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                rows={5}
              />
            </div>
            {addError && (
              <p className="text-sm text-destructive" role="alert">
                {addError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false)
                  setAddError(null)
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const reference = data.assets.find(
                      (asset) => !customAssets.some((custom) => custom.isin === asset.isin),
                    )
                    if (!reference || !data.dailyVix) {
                      throw new Error('The shared daily VIX/weekly reference data is unavailable.')
                    }
                    const asset = createCustomAssetFromCsv(addForm, data.dailyVix, reference)
                    addCustomAsset(asset)
                    setAddError(null)
                    setAddForm({
                      ticker: '',
                      name: '',
                      isin: '',
                      type: 'stock',
                      currency: 'USD',
                      exchange: 'NASDAQ',
                      priceCsv: '',
                    })
                  } catch (cause) {
                    setAddError(cause instanceof Error ? cause.message : 'Failed to add asset.')
                  }
                }}
                className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm"
              >
                Save asset locally
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Imported daily closes use the same VIX dates and peak/recovery calculations as built-in assets.
              Entries are saved in this browser&apos;s local storage only, not published or synced to other
              devices.
            </p>
            {customAssets.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Saved local assets ({customAssets.length})</h3>
                  {customAssets.some((asset) => asset.customDataSource === 'Twelve Data') && (
                    <button
                      type="button"
                      onClick={() => void refreshCustomAssets(true)}
                      disabled={refreshingCustomAssets}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshingCustomAssets ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      {refreshingCustomAssets ? 'Refreshing…' : 'Refresh online assets'}
                    </button>
                  )}
                </div>
                {customAssetRefreshError && (
                  <p className="text-xs text-destructive" role="alert">
                    {customAssetRefreshError}
                  </p>
                )}
                {customAssets.map((asset) => (
                  <div key={asset.isin} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <strong>{asset.ticker}</strong> · {asset.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({asset.customDataSource ?? 'Local'}
                        {asset.customLastFetchedAt
                          ? ` · updated ${formatDate(asset.customLastFetchedAt.slice(0, 10))}`
                          : ''}
                        )
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomAsset(asset.isin)}
                      className="shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                      aria-label={`Remove ${asset.ticker} from local assets`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                          <p className="flex items-center gap-2 font-semibold">
                            {asset.ticker}
                            {asset.customDataSource && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                {asset.customDataSource}
                              </span>
                            )}
                          </p>
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
                      {asset.customDataSource && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {asset.customDataSource}
                        </span>
                      )}
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
