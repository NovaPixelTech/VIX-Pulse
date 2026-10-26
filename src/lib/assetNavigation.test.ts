import { describe, expect, it } from 'vitest'
import type { Asset } from '@/types'
import { orderAssetsForNavigation } from './assetNavigation'

function makeAsset(ticker: string): Asset {
  return {
    isin: `ISIN-${ticker}`,
    ticker,
    name: `${ticker} Corporation`,
    type: 'stock',
    currency: 'USD',
    exchange: 'NYSE',
    peaks: [],
    summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
    priceSeries: {
      dates: [],
      vix: [],
      price: [],
      frequency: 'weekly',
    },
  }
}

const msft = makeAsset('MSFT')
const aapl = makeAsset('AAPL')
const nvda = makeAsset('NVDA')

describe('asset navigation order', () => {
  it('follows the ranked order supplied by the dashboard', () => {
    const ordered = orderAssetsForNavigation([msft, aapl, nvda], [nvda.isin, aapl.isin, msft.isin])

    expect(ordered.map((asset) => asset.ticker)).toEqual(['NVDA', 'AAPL', 'MSFT'])
  })

  it('keeps assets that are missing from a stale preferred order reachable', () => {
    const ordered = orderAssetsForNavigation([msft, aapl, nvda], [nvda.isin])

    expect(ordered.map((asset) => asset.ticker)).toEqual(['NVDA', 'MSFT', 'AAPL'])
  })

  it('ignores duplicate and unknown ISINs', () => {
    const ordered = orderAssetsForNavigation([msft, aapl, nvda], [aapl.isin, 'UNKNOWN', aapl.isin])

    expect(ordered.map((asset) => asset.ticker)).toEqual(['AAPL', 'MSFT', 'NVDA'])
  })

  it('falls back to ticker order for direct links', () => {
    const ordered = orderAssetsForNavigation([msft, nvda, aapl])

    expect(ordered.map((asset) => asset.ticker)).toEqual(['AAPL', 'MSFT', 'NVDA'])
  })
})
