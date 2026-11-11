import { useCallback, useEffect, useRef, useState } from 'react'
import { REALTIME_VIX_POLL_MS, fetchRealtimeVix, type RealtimeVixQuote } from '@/lib/realtimeVix'

export interface RealtimeVixState {
  quote: RealtimeVixQuote | null
  /** True until the first live attempt has settled. */
  loading: boolean
  /** True while a live fetch is in flight. */
  refreshing: boolean
  error: string | null
  refresh: () => void
}

/**
 * Polls the live VIX quote about once a minute while the tab is visible.
 * Polling pauses when the tab is hidden and catches up immediately on return
 * when the last quote is older than the poll interval.
 */
export function useRealtimeVix(): RealtimeVixState {
  const [quote, setQuote] = useState<RealtimeVixQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastRunRef = useRef(0)
  const mountedRef = useRef(true)

  const run = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    lastRunRef.current = Date.now()
    setRefreshing(true)
    try {
      const next = await fetchRealtimeVix()
      if (!mountedRef.current) return
      setQuote(next)
      setError(null)
    } catch (cause) {
      if (!mountedRef.current) return
      setError(cause instanceof Error ? cause.message : 'Live VIX is unavailable.')
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) {
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    let timer: number | undefined

    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
    }

    // Hidden tabs never schedule; the visibility handler restarts polling on return.
    const schedule = (delay: number) => {
      clearTimer()
      if (document.visibilityState !== 'visible') return
      timer = window.setTimeout(() => void poll(), delay)
    }

    const poll = async () => {
      await run()
      if (cancelled) return
      schedule(REALTIME_VIX_POLL_MS)
    }

    const handleVisibilityChange = () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRunRef.current
        if (elapsed >= REALTIME_VIX_POLL_MS) void poll()
        else schedule(REALTIME_VIX_POLL_MS - elapsed)
      } else {
        clearTimer()
      }
    }

    void poll()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      mountedRef.current = false
    }
  }, [run])

  const refresh = useCallback(() => {
    void run()
  }, [run])

  return { quote, loading, refreshing, error, refresh }
}
