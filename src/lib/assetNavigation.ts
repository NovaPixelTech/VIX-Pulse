import type { Asset } from '@/types'

/**
 * Build the sequence used by the previous/next controls on an asset page.
 * A preferred order is supplied when the user opens an asset from the ranked
 * dashboard list; direct links fall back to a stable ticker order.
 */
export function orderAssetsForNavigation(assets: Asset[], preferredOrder?: string[]): Asset[] {
  const byIsin = new Map(assets.map((asset) => [asset.isin, asset]))

  if (!preferredOrder?.length) {
    return [...assets].sort(
      (a, b) =>
        a.ticker.localeCompare(b.ticker, undefined, { sensitivity: 'base' }) || a.isin.localeCompare(b.isin),
    )
  }

  const seen = new Set<string>()
  const ordered: Asset[] = []

  for (const isin of preferredOrder) {
    const asset = byIsin.get(isin)
    if (asset && !seen.has(isin)) {
      ordered.push(asset)
      seen.add(isin)
    }
  }

  // Keep newly added or stale assets reachable even if the supplied order is
  // older than the current dataset.
  for (const asset of assets) {
    if (!seen.has(asset.isin)) ordered.push(asset)
  }

  return ordered
}
