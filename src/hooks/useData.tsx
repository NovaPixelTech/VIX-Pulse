import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, Dataset } from '@/types'
import { createCustomAssetFromPrices } from '@/lib/customAssets'
import { fetchTwelveDataDailyPrices, getTwelveDataApiKey } from '@/lib/twelveData'

interface DataContextType {
  data: Dataset | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refreshError: string | null
  refreshData: () => Promise<void>
  refreshCustomAssets: (force?: boolean) => Promise<void>
  refreshingCustomAssets: boolean
  customAssetRefreshError: string | null
  addCustomAsset: (asset: Asset) => void
  removeCustomAsset: (isin: string) => void
  customAssets: Asset[]
}

const CUSTOM_ASSETS_KEY = 'vix-pulse-custom-assets'

function normalizeIdentifier(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? ''
}

function isSameAsset(left: Asset, right: Asset): boolean {
  const leftIsin = normalizeIdentifier(left.isin)
  const rightIsin = normalizeIdentifier(right.isin)
  const leftTicker = normalizeIdentifier(left.ticker)
  const rightTicker = normalizeIdentifier(right.ticker)
  return Boolean(
    (leftIsin && rightIsin && leftIsin === rightIsin) || (leftTicker && leftTicker === rightTicker),
  )
}

function loadCustomAssets(): Asset[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(CUSTOM_ASSETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomAssets(assets: Asset[]) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CUSTOM_ASSETS_KEY, JSON.stringify(assets))
  } catch {
    // ignore
  }
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshingCustomAssets, setRefreshingCustomAssets] = useState(false)
  const [customAssetRefreshError, setCustomAssetRefreshError] = useState<string | null>(null)
  const [customAssets, setCustomAssets] = useState<Asset[]>(() => loadCustomAssets())
  const autoRefreshStarted = useRef(false)

  const fetchLatestSnapshot = useCallback(async () => {
    const url = `${import.meta.env.BASE_URL}data/vix-pulse.json?refresh=${Date.now()}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Market data request failed (${response.status})`)
    return (await response.json()) as Dataset
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchLatestSnapshot()
      .then((snapshot) => {
        if (cancelled) return
        setData(snapshot)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchLatestSnapshot])

  const refreshData = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const snapshot = await fetchLatestSnapshot()
      setData(snapshot)
      setError(null)
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Unknown market data error')
    } finally {
      setRefreshing(false)
    }
  }, [fetchLatestSnapshot])

  const refreshCustomAssets = useCallback(
    async (force = false) => {
      const apiKey = getTwelveDataApiKey()
      if (!apiKey) {
        if (force)
          setCustomAssetRefreshError('Save a Twelve Data API key in the dashboard before refreshing.')
        return
      }
      if (!data?.dailyVix?.dates[0] || customAssets.length === 0) return

      const providerAssets = customAssets.filter(
        (asset) => asset.customDataSource === 'Twelve Data' && asset.customProviderSymbol,
      )
      if (providerAssets.length === 0) return

      setRefreshingCustomAssets(true)
      setCustomAssetRefreshError(null)
      const now = Date.now()
      const nowIso = new Date(now).toISOString()
      const today = nowIso.slice(0, 10)
      const reference = data.assets.find((asset) => !asset.customDataSource && !asset.placeholder)
      if (!reference) {
        setCustomAssetRefreshError(
          'Published reference price data is unavailable for rebuilding custom assets.',
        )
        setRefreshingCustomAssets(false)
        return
      }

      const nextAssets = [...customAssets]
      const failures: string[] = []
      try {
        for (const asset of providerAssets) {
          const fetchedAt = asset.customLastFetchedAt ? Date.parse(asset.customLastFetchedAt) : 0
          if (!force && Number.isFinite(fetchedAt) && now - fetchedAt < 24 * 60 * 60 * 1000) continue

          try {
            const existingPrices = asset.customPriceHistory ?? []
            const startDate = existingPrices[0]?.date ?? data.dailyVix.dates[0]
            const series = await fetchTwelveDataDailyPrices(
              {
                symbol: asset.customProviderSymbol!,
                instrument_name: asset.name,
                exchange: asset.exchange,
                currency: asset.currency,
                instrument_type: asset.type,
              },
              apiKey,
              startDate,
              today,
            )
            const byDate = new Map(existingPrices.map((price) => [price.date, price.close]))
            for (const price of series.prices) byDate.set(price.date, price.close)
            const prices = [...byDate.entries()]
              .map(([date, close]) => ({ date, close }))
              .sort((left, right) => left.date.localeCompare(right.date))
            const updated = createCustomAssetFromPrices(
              {
                ticker: asset.ticker,
                name: asset.name,
                isin: asset.isin,
                type: asset.type,
                currency: series.instrument.currency,
                exchange: series.instrument.exchange,
              },
              prices,
              data.dailyVix,
              reference,
            )
            updated.customDataSource = 'Twelve Data'
            updated.customProviderSymbol = asset.customProviderSymbol
            updated.customLastFetchedAt = nowIso
            const assetIndex = nextAssets.findIndex((current) => isSameAsset(current, asset))
            if (assetIndex >= 0) nextAssets[assetIndex] = updated
          } catch (cause) {
            failures.push(`${asset.ticker}: ${cause instanceof Error ? cause.message : 'refresh failed'}`)
          }
        }

        if (nextAssets.some((asset, index) => asset !== customAssets[index])) {
          setCustomAssets(nextAssets)
          saveCustomAssets(nextAssets)
        }
        if (failures.length > 0) setCustomAssetRefreshError(failures.join(' '))
      } finally {
        setRefreshingCustomAssets(false)
      }
    },
    [customAssets, data],
  )

  useEffect(() => {
    if (autoRefreshStarted.current || !data || !getTwelveDataApiKey()) return
    autoRefreshStarted.current = true
    void refreshCustomAssets(false)
  }, [data, refreshCustomAssets])

  const addCustomAsset = useCallback((asset: Asset) => {
    setCustomAssets((prev) => {
      const filtered = prev.filter((existing) => !isSameAsset(existing, asset))
      const next = [...filtered, asset]
      saveCustomAssets(next)
      return next
    })
  }, [])

  const removeCustomAsset = useCallback((isin: string) => {
    setCustomAssets((prev) => {
      const normalizedIsin = normalizeIdentifier(isin)
      const next = prev.filter((asset) => normalizeIdentifier(asset.isin) !== normalizedIsin)
      saveCustomAssets(next)
      return next
    })
  }, [])

  const mergedData = useMemo(() => {
    if (!data || customAssets.length === 0) return data
    const reference = data.assets.find((asset) => !asset.customDataSource && !asset.placeholder)
    const analyzedCustomAssets = customAssets.map((asset) => {
      if (!asset.customPriceHistory || !data.dailyVix || !reference) return asset
      try {
        const rebuilt = createCustomAssetFromPrices(
          {
            ticker: asset.ticker,
            name: asset.name,
            isin: asset.isin,
            type: asset.type,
            currency: asset.currency,
            exchange: asset.exchange,
          },
          asset.customPriceHistory,
          data.dailyVix,
          reference,
        )
        return {
          ...rebuilt,
          customDataSource: asset.customDataSource,
          customProviderSymbol: asset.customProviderSymbol,
          customLastFetchedAt: asset.customLastFetchedAt,
        }
      } catch {
        return asset
      }
    })
    return {
      ...data,
      assets: [
        ...analyzedCustomAssets,
        ...data.assets.filter((asset) => !analyzedCustomAssets.some((custom) => isSameAsset(custom, asset))),
      ],
    }
  }, [customAssets, data])

  return (
    <DataContext.Provider
      value={{
        data: mergedData,
        loading,
        error,
        refreshing,
        refreshError,
        refreshData,
        refreshCustomAssets,
        refreshingCustomAssets,
        customAssetRefreshError,
        addCustomAsset,
        removeCustomAsset,
        customAssets,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
