import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dataset } from '@/types'

interface DataContextType {
  data: Dataset | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refreshError: string | null
  refreshData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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

  return (
    <DataContext.Provider value={{ data, loading, error, refreshing, refreshError, refreshData }}>
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
