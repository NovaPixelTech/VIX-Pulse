import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, Dataset } from '@/types'

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
      const filtered = prev.filter((a) => a.isin !== asset.isin && a.ticker !== asset.ticker)
      const next = [...filtered, asset]
      saveCustomAssets(next)
      return next
    })
  }, [])

  const removeCustomAsset = useCallback((isin: string) => {
    setCustomAssets((prev) => {
      const next = prev.filter((a) => a.isin !== isin)
      saveCustomAssets(next)
      return next
    })
  }, [])

  const mergedData =
    data && customAssets.length > 0
      ? {
          ...data,
          assets: [
            ...customAssets,
            ...data.assets.filter(
              (a) => !customAssets.some((c) => c.isin === a.isin || c.ticker === a.ticker),
            ),
          ],
        }
      : data

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
