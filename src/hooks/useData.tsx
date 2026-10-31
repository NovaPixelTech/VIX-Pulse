import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, Dataset } from '@/types'
import { createCustomAssetFromPrices } from '@/lib/customAssets'

interface DataContextType {
  data: Dataset | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refreshError: string | null
  refreshData: () => Promise<void>
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
  const [customAssets, setCustomAssets] = useState<Asset[]>(() => loadCustomAssets())

  useEffect(() => {
    try {
      window.localStorage.removeItem('vix-pulse-twelvedata-api-key')
    } catch {
      // Ignore unavailable browser storage; this app no longer uses a provider API key.
    }
  }, [])

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
