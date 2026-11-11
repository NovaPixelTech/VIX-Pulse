import { describe, expect, it } from 'vitest'
import { buildVixLiveReaderUrl, deriveMarketState, parseRealtimeVixQuote } from './realtimeVix'

// Observed ^VIX feed facts: the regular session ends 21:15 UTC (15:15 America/Chicago),
// Yahoo reports an unreliable early start for the index, and quote times lag the
// exchange while the market is open.
const FETCHED_AT_MS = Date.parse('2026-11-10T21:10:00Z')

function relayText(meta: object, timestamps: number[], closes: Array<number | null>): string {
  return `Title: \n\nURL Source: http://query1.finance.yahoo.com/v8/finance/chart/%5EVIX\n\nMarkdown Content:\n${JSON.stringify(
    {
      chart: {
        result: [
          {
            meta,
            timestamp: timestamps,
            indicators: { quote: [{ close: closes }] },
          },
        ],
        error: null,
      },
    },
  )}`
}

const LIVE_META = {
  currency: 'USD',
  symbol: '^VIX',
  exchangeName: 'CXI',
  fullExchangeName: 'Cboe Indices',
  exchangeTimezoneName: 'America/Chicago',
  gmtoffset: -21600,
  instrumentType: 'INDEX',
  regularMarketPrice: 19.53,
  chartPreviousClose: 19.92,
  regularMarketTime: 1794344656,
  regularMarketDayHigh: 21.61,
  regularMarketDayLow: 19.29,
  hasPrePostMarketData: false,
  currentTradingPeriod: {
    regular: { start: 1794297600, end: 1794345300, gmtoffset: -21600 },
  },
}

describe('live VIX reader URL', () => {
  it('targets the Yahoo chart endpoint through the Jina relay', () => {
    const url = buildVixLiveReaderUrl()
    expect(url).toBe(
      'https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/%255EVIX?range=1d%26interval=5m',
    )
  })
})

describe('live VIX quote parsing', () => {
  it('extracts the price, change, session facts, and intraday closes', () => {
    const quote = parseRealtimeVixQuote(
      relayText(LIVE_META, [1794297600, 1794297900, 1794298200, 1794298500], [19.85, 19.81, null, 19.9]),
      FETCHED_AT_MS,
    )

    expect(quote.price).toBe(19.53)
    expect(quote.previousClose).toBe(19.92)
    expect(quote.changeAbs).toBe(-0.39)
    expect(quote.changePct).toBe(-1.96)
    expect(quote.quoteTimeMs).toBe(1794344656000)
    expect(quote.marketState).toBe('regular')
    expect(quote.exchangeTimeZone).toBe('America/Chicago')
    expect(quote.dayHigh).toBe(21.61)
    expect(quote.dayLow).toBe(19.29)
    expect(quote.fetchedAtMs).toBe(FETCHED_AT_MS)
    expect(quote.intraday).toEqual([
      { timeMs: 1794297600000, close: 19.85 },
      { timeMs: 1794297900000, close: 19.81 },
      { timeMs: 1794298500000, close: 19.9 },
    ])
  })

  it('falls back to the regular previous close when the chart close is missing', () => {
    const quote = parseRealtimeVixQuote(
      relayText({ ...LIVE_META, chartPreviousClose: undefined, previousClose: 19.5 }, [], []),
      FETCHED_AT_MS,
    )
    expect(quote.previousClose).toBe(19.5)
    expect(quote.changeAbs).toBe(0.03)
    expect(quote.intraday).toEqual([])
  })

  it('rejects payloads without a usable live price', () => {
    expect(() =>
      parseRealtimeVixQuote(relayText({ ...LIVE_META, regularMarketPrice: null }, [], [])),
    ).toThrow(/no live VIX price/)
    expect(() =>
      parseRealtimeVixQuote(
        'Title: \n\nMarkdown Content:\n{"chart":{"result":null,"error":null}}',
        FETCHED_AT_MS,
      ),
    ).toThrow(/no live VIX price/)
  })
})

describe('market state derivation', () => {
  it('marks the session open while quotes keep updating inside the window', () => {
    expect(deriveMarketState(LIVE_META, LIVE_META.regularMarketTime, FETCHED_AT_MS)).toBe('regular')
  })

  it('marks the session closed before the open, after the close, and on weekends', () => {
    expect(
      deriveMarketState(LIVE_META, LIVE_META.regularMarketTime, Date.parse('2026-11-10T13:00:00Z')),
    ).toBe('closed')
    expect(
      deriveMarketState(LIVE_META, LIVE_META.regularMarketTime, Date.parse('2026-11-10T23:00:00Z')),
    ).toBe('closed')
    expect(
      deriveMarketState(LIVE_META, LIVE_META.regularMarketTime, Date.parse('2026-11-14T12:00:00Z')),
    ).toBe('closed')
  })

  it('requires a recently updating quote when the reported start is unreliable', () => {
    const staleQuoteMeta = { ...LIVE_META, regularMarketTime: Date.parse('2026-11-09T21:10:00Z') / 1000 }
    expect(deriveMarketState(staleQuoteMeta, staleQuoteMeta.regularMarketTime, FETCHED_AT_MS)).toBe('closed')
    // A quote from slightly in the future still counts as updating (client clock skew).
    expect(
      deriveMarketState(LIVE_META, LIVE_META.regularMarketTime + 60, Date.parse('2026-11-10T21:10:30Z')),
    ).toBe('regular')
  })

  it('reports extended-hours states only when the instrument trades them', () => {
    const stockMeta = {
      ...LIVE_META,
      hasPrePostMarketData: true,
      currentTradingPeriod: {
        regular: {
          start: Date.parse('2026-11-10T14:30:00Z') / 1000,
          end: Date.parse('2026-11-10T21:00:00Z') / 1000,
        },
      },
    }
    expect(
      deriveMarketState(stockMeta, LIVE_META.regularMarketTime, Date.parse('2026-11-10T13:00:00Z')),
    ).toBe('pre')
    expect(
      deriveMarketState(stockMeta, LIVE_META.regularMarketTime, Date.parse('2026-11-10T22:00:00Z')),
    ).toBe('post')
  })

  it('falls back to the window when no quote time is available, and to closed without either', () => {
    expect(deriveMarketState({ ...LIVE_META, regularMarketTime: undefined }, null, FETCHED_AT_MS)).toBe(
      'regular',
    )
    expect(deriveMarketState({ ...LIVE_META, currentTradingPeriod: undefined }, null, FETCHED_AT_MS)).toBe(
      'closed',
    )
  })
})
