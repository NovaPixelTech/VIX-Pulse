import { useEffect } from 'react'

const DEFAULT_TITLE = 'VIX Pulse — VIX response and asset recovery analytics'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · VIX Pulse` : DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
