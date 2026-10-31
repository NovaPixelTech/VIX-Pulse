import { describe, expect, it } from 'vitest'
import { buildYahooChartReaderUrl, buildYahooCsv, fetchYahooDailyCsv, normalizeYahooSymbol } from './yahooCsv'

const chartJson = JSON.stringify({
  chart: {
    result: [
      {
        meta: {
          currency: 'USD',
          symbol: 'AAPL',
          exchangeName: 'NMS',
          fullExchangeName: 'NasdaqGS',
          longName: 'Apple Inc.',
          exchangeTimezoneName: 'America/New_York',
          gmtoffset: -18000,
          instrumentType: 'EQUITY',
        },
        timestamp: [1735828200, 1735914600, 1736173800],
        indicators: {
          quote: [
            {
              open: [99.1, 100.2, 101.3],
              high: [101, 102, 103],
              low: [98, 99, 100],
              close: [100, 101, null],
              volume: [1000, 2000, 3000],
            },
          ],
          adjclose: [{ adjclose: [99, 100, 102] }],
        },
      },
    ],
    error: null,
  },
})

describe('Yahoo CSV downloads', () => {
  it('turns the Yahoo reader payload into a dated CSV and prefers adjusted closes', () => {
    const result = buildYahooCsv(
      `Title: \n\nURL Source: http://query1.finance.yahoo.com/v8/finance/chart/AAPL\n\nMarkdown Content:\n${chartJson}`,
      'AAPL',
    )

    expect(result).toMatchObject({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currency: 'USD',
      exchange: 'NasdaqGS',
      instrumentType: 'EQUITY',
      firstDate: '2025-01-02',
      lastDate: '2025-01-06',
      rowCount: 3,
      filename: 'AAPL_2025-01-02_2025-01-06.csv',
    })
    expect(result.csv).toBe(
      [
        'Date,Open,High,Low,Close,Adj Close,Volume',
        '2025-01-02,99.1,101,98,100,99,1000',
        '2025-01-03,100.2,102,99,101,100,2000',
        '2025-01-06,101.3,103,100,102,102,3000',
        '',
      ].join('\n'),
    )
  })

  it('falls back to close when Yahoo omits adjusted close', () => {
    const payload = JSON.stringify({
      chart: {
        result: [
          {
            meta: { symbol: 'RHM.DE', currency: 'EUR', exchangeTimezoneName: 'Europe/Berlin' },
            timestamp: [1735828200, 1735914600],
            indicators: {
              quote: [
                {
                  open: [1, 2],
                  high: [3, 4],
                  low: [0.5, 1],
                  close: [10, 11],
                  volume: [100, 200],
                },
              ],
            },
          },
        ],
      },
    })
    const result = buildYahooCsv(payload, 'RHM.DE')
    expect(result.csv).toContain('2025-01-02,1,3,0.5,10,10,100')
    expect(result.csv).toContain('2025-01-03,2,4,1,11,11,200')
  })

  it('normalises London pence quotes to pounds like the published assets', () => {
    const payload = JSON.stringify({
      chart: {
        result: [
          {
            meta: { symbol: 'BP.L', currency: 'GBp', exchangeTimezoneName: 'Europe/London' },
            timestamp: [1735828200, 1735914600],
            indicators: {
              quote: [
                {
                  open: [430, 431],
                  high: [432, 433],
                  low: [429, 430],
                  close: [431.05, 432.5],
                  volume: [100, 200],
                },
              ],
              adjclose: [{ adjclose: [430.8, 432.3] }],
            },
          },
        ],
      },
    })
    const result = buildYahooCsv(payload, 'BP.L')
    expect(result.currency).toBe('GBP')
    expect(result.csv).toContain('2025-01-02,4.3,4.32,4.29,4.3105,4.308,100')
    expect(result.csv).toContain('2025-01-03,4.31,4.33,4.3,4.325,4.323,200')
  })

  it('builds a reader URL for the selected Yahoo range and escapes the target query', () => {
    const url = buildYahooChartReaderUrl('^GSPC', '2025-09-01', '2025-09-30')
    expect(url).toContain('https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/')
    expect(url).toContain('%255EGSPC')
    expect(url).toContain('period1=1756684800')
    expect(url).toContain('period2=1759276799')
    expect(url).toContain('%26interval=1d')
    expect(url).toContain('%252Csplits')
  })

  it('rejects invalid dates, reversed ranges, and invalid symbols', () => {
    expect(() => normalizeYahooSymbol('bad symbol')).toThrow(/valid Yahoo Finance symbol/)
    expect(() => buildYahooChartReaderUrl('AAPL', '2025-02-30', '2025-03-01')).toThrow(/valid start date/)
    expect(() => buildYahooChartReaderUrl('AAPL', '2025-03-02', '2025-03-01')).toThrow(
      /end date must be on or after/,
    )
  })

  it('surfaces Yahoo errors and unreadable responses', () => {
    expect(() => buildYahooCsv('not a chart response', 'AAPL')).toThrow(/unreadable/)
    expect(() =>
      buildYahooCsv(
        JSON.stringify({
          chart: { result: null, error: { code: 'Not Found', description: 'No data found' } },
        }),
        'AAPL',
      ),
    ).toThrow('No data found')
  })

  it('fetches the reader payload and returns the generated CSV', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(chartJson, { status: 200 })) as typeof fetch
    try {
      const result = await fetchYahooDailyCsv('AAPL', '2025-01-01', '2025-01-10')
      expect(result.rowCount).toBe(3)
      expect(result.csv).toContain('2025-01-02')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
