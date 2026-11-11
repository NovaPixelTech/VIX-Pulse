import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import RealtimeVixBanner from './RealtimeVixBanner'
import type { Dataset } from '@/types'

// Rendering the banner with createRoot/act requires the React act environment flag.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const dataset: Dataset = {
  generatedAt: '2026-11-03T03:39:12Z',
  vixThresholdPeak: 21,
  vixThresholdRecovery: 20,
  dateRange: { from: '2026-10-30', to: '2026-10-30' },
  assets: [],
  vixMetrics: {
    currentVix: 21.15,
    currentDate: '2026-11-02',
    previousDayVix: 19.42,
    previousDayDate: '2026-10-30',
    changeDayAbs: 1.73,
    changeDayPct: 8.91,
    latestWeekVix: 19.42,
    latestWeekDate: '2026-10-30',
    previousWeekVix: 19.45,
    previousWeekDate: '2026-10-23',
    changeWeekAbs: -0.03,
    changeWeekPct: -0.15,
  },
}

const liveRelayText = `Title: \n\nURL Source: http://query1.finance.yahoo.com/v8/finance/chart/%5EVIX\n\nMarkdown Content:\n${JSON.stringify(
  {
    chart: {
      result: [
        {
          meta: {
            currency: 'USD',
            symbol: '^VIX',
            exchangeTimezoneName: 'America/Chicago',
            regularMarketPrice: 19.53,
            chartPreviousClose: 19.92,
            regularMarketTime: 1794344656,
            regularMarketDayHigh: 21.61,
            regularMarketDayLow: 19.29,
            hasPrePostMarketData: false,
            currentTradingPeriod: {
              regular: { start: 1794297600, end: 1794345300, gmtoffset: -21600 },
            },
          },
          timestamp: [1794297600, 1794297900, 1794298200],
          indicators: { quote: [{ close: [19.85, 19.81, 19.9] }] },
        },
      ],
      error: null,
    },
  },
)}`

describe('RealtimeVixBanner', () => {
  const originalFetch = globalThis.fetch
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    globalThis.fetch = originalFetch
  })

  it('renders the live quote with its regime colour once the relay responds', async () => {
    globalThis.fetch = (async () => new Response(liveRelayText, { status: 200 })) as typeof fetch
    await act(async () => {
      root.render(<RealtimeVixBanner data={dataset} />)
    })

    const banner = container.querySelector('section[aria-label="Live VIX index level"]')
    expect(banner).not.toBeNull()
    // 19.53 sits in the Normal regime (15 <= VIX < 20), which is emerald.
    expect(banner?.className).toContain('border-emerald-500/30')

    const bigNumber = banner?.querySelector('p.text-7xl')
    expect(bigNumber?.className).toContain('text-emerald')
    expect(bigNumber?.textContent).toBe('19.53')

    expect(banner?.textContent).toContain('Live')
    expect(banner?.textContent).toContain('Normal volatility')
    expect(banner?.textContent).toContain('-0.39')
    expect(banner?.textContent).toContain('(-1.96%)')
    expect(banner?.textContent).toContain('vs previous close 19.92')
    expect(banner?.textContent).toMatch(/Market (open|closed)/)
    expect(banner?.querySelector('svg[preserveAspectRatio="none"]')).not.toBeNull()
    expect(banner?.querySelector('[role="img"]')).not.toBeNull()
    expect(banner?.textContent).toContain('Live VIX 19.53')
  })

  it('falls back to the published snapshot when the live relay fails', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('network error')
    }) as typeof fetch
    await act(async () => {
      root.render(<RealtimeVixBanner data={dataset} />)
    })

    const banner = container.querySelector('section[aria-label="Live VIX index level"]')
    expect(banner).not.toBeNull()
    // 21.15 sits in the Elevated regime (20 <= VIX < 30), which is amber.
    expect(banner?.className).toContain('border-amber-500/30')

    const bigNumber = banner?.querySelector('p.text-7xl')
    expect(bigNumber?.className).toContain('text-amber')
    expect(bigNumber?.textContent).toBe('21.15')

    expect(banner?.textContent).toContain('Published snapshot close')
    expect(banner?.textContent).toContain('Live quote unavailable right now')
    expect(banner?.textContent).toContain('vs previous close 19.42')
    expect(banner?.querySelector('svg[preserveAspectRatio="none"]')).toBeNull()
  })
})
