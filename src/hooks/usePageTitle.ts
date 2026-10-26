import { useEffect } from 'react'

const DEFAULT_TITLE = 'VIX Pulse — VIX peaks and asset recovery dashboard'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · VIX Pulse` : DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
