import { describe, expect, it } from 'vitest'
import type { Asset, DailyVixSeries } from '@/types'
import { createCustomAssetFromCsv, parseDailyPriceCsv } from './customAssets'
import { rankVixResponses } from './vixResponse'

const dailyVix: DailyVixSeries = {
  dates: ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04'],
  high: [18, 24, 18, 17],
  close: [18, 22, 19, 18],
}

const weeklyReference: Asset = {
  isin: 'REFERENCE',
  ticker: 'REF',
  name: 'Reference',
  type: 'stock',
  currency: 'USD',
  exchange: 'NASDAQ',
  peaks: [],
  summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
  priceSeries: {
    dates: ['2025-08-29', '2025-09-05'],
    vix: [18, 18],
    price: [90, 100],
    frequency: 'weekly',
  },
}

describe('custom asset imports', () => {
  it('parses Yahoo daily CSV and prefers adjusted closes', () => {
    expect(
      parseDailyPriceCsv(
        [
          'Date,Open,High,Low,Close,Adj Close,Volume',
          '2025-09-03,109,111,108,110,110.5,1000',
          '2025-09-02,99,101,98,100,100.25,1200',
        ].join('\n'),
      ),
    ).toEqual([
      { date: '2025-09-02', close: 100.25 },
      { date: '2025-09-03', close: 110.5 },
    ])
  })

  it('builds an asset on the shared daily VIX calendar and calculates peak/recovery returns', () => {
    const asset = createCustomAssetFromCsv(
      {
        ticker: '',
        name: '',
        isin: 'US1234567890',
        type: 'stock',
        currency: 'USD',
        exchange: 'NASDAQ',
        priceCsv: [
          'Date,Close',
          '2025-08-29,90',
          '2025-09-01,95',
          '2025-09-02,100',
          '2025-09-03,110',
          '2025-09-04,112',
        ].join('\n'),
      },
      dailyVix,
      weeklyReference,
    )

    expect(asset.ticker).toBe('US1234567890')
    expect(asset.name).toBe('US1234567890')
    expect(asset.dailyPriceSeries).toEqual([95, 100, 110, 112])
    expect(asset.dailyPriceObserved).toEqual([true, true, true, true])
    expect(asset.priceSeries.price).toEqual([90, 112])
    expect(asset.peaks).toHaveLength(1)
    expect(asset.peaks[0]).toMatchObject({
      vixPeakDate: '2025-09-02',
      assetPriceAtPeak: 100,
      vixRecoveryDate: '2025-09-03',
      assetPriceAtRecovery: 110,
      percentChange: 10,
    })
    expect(asset.latestQuote).toMatchObject({ price: 112, date: '2025-09-04', previousPrice: 110 })
    const [rankedAsset] = rankVixResponses([asset], 21, 20, dailyVix)
    expect(rankedAsset.asset.isin).toBe(asset.isin)
    expect(rankedAsset.stats.reboundPct.average).toBeCloseTo(10, 8)
    expect(rankedAsset.vixCoMovement.observations).toBe(3)
  })

  it('can use a name as the identifier when ticker and ISIN are omitted', () => {
    const asset = createCustomAssetFromCsv(
      {
        ticker: '',
        name: 'Test Company',
        isin: '',
        type: 'stock',
        currency: 'USD',
        exchange: 'NASDAQ',
        priceCsv: 'Date,Close\n2025-08-29,90\n2025-09-02,100\n2025-09-03,110',
      },
      dailyVix,
      weeklyReference,
    )

    expect(asset.ticker).toBe('TEST-COMPANY')
    expect(asset.isin).toBe('CUSTOM-TEST-COMPANY')
  })

  it('rejects imports without enough valid dated prices', () => {
    expect(() => parseDailyPriceCsv('Date,Close\nnot-a-date,0')).toThrow(/at least two/)
  })
})
