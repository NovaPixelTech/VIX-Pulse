import { describe, expect, it } from 'vitest'
import type { Dataset } from '@/types'
import {
  convertCurrency,
  getFxRateToUsd,
  getLatestTermStructure,
  getMarketContext,
  getVixPercentile,
  getTermStructureRegime,
} from './marketContext'

const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']

function makeDataset(): Dataset {
  return {
    generatedAt: '2024-01-05T00:00:00Z',
    vixThresholdPeak: 21,
    vixThresholdRecovery: 20,
    dateRange: { from: dates[0], to: dates[4] },
    dailyVix: {
      dates,
      high: [15, 18, 22, 19, 25],
      close: [15, 18, 22, 19, 25],
    },
    benchmark: {
      ticker: 'SPY',
      name: 'SPY',
      currency: 'USD',
      dates,
      close: [100, 101, 100, 102, 104],
    },
    termStructure: {
      dates,
      vix: [18, 19, 21, 20, 30],
      vix9d: [17, 18, 20, 19, 32],
      vix3m: [20, 20, 21, 21, 24],
      vix6m: [21, 21, 22, 22, 23],
    },
    fx: {
      dates,
      EURUSD: [1.1, 1.1, 1.2, 1.2, 1.2],
      GBPUSD: [1.3, 1.3, 1.4, 1.4, 1.4],
    },
    assets: [],
  }
}

describe('getVixPercentile', () => {
  it('ranks the latest close within the requested lookback', () => {
    const dataset = makeDataset()
    const result = getVixPercentile(dataset.dailyVix, 3)
    expect(result.value).toBe(25)
    expect(result.percentile).toBe(100)
    expect(result.observations).toBe(3)
    expect(result.from).toBe('2024-01-03')
  })

  it('returns mid-rank for a flat series', () => {
    const result = getVixPercentile({ dates: ['a', 'b', 'c'], high: [20, 20, 20], close: [20, 20, 20] }, 3)
    expect(result.percentile).toBe(50)
  })
})

describe('term structure', () => {
  it('classifies an inverted curve as backwardation', () => {
    expect(getTermStructureRegime(1.2)).toBe('backwardation')
    expect(getTermStructureRegime(0.9)).toBe('contango')
    expect(getTermStructureRegime(0.97)).toBe('flat')
  })

  it('summarises the latest curve and its ratios', () => {
    const snapshot = getLatestTermStructure(makeDataset().termStructure)
    expect(snapshot.vix).toBe(30)
    expect(snapshot.vix3m).toBe(24)
    expect(snapshot.frontRatio).toBeCloseTo(1.25, 6)
    expect(snapshot.regime).toBe('backwardation')
    expect(snapshot.slopePct).toBeCloseTo(-20, 6)
  })
})

describe('currency conversion', () => {
  it('converts through USD rates in both directions', () => {
    const fx = makeDataset().fx
    expect(getFxRateToUsd('USD', fx)).toBe(1)
    expect(convertCurrency(100, 'EUR', 'USD', fx, '2024-01-03')).toBeCloseTo(120, 6)
    expect(convertCurrency(120, 'USD', 'EUR', fx, '2024-01-03')).toBeCloseTo(100, 6)
    expect(convertCurrency(100, 'EUR', 'GBP', fx, '2024-01-03')).toBeCloseTo(85.714285, 5)
    expect(convertCurrency(100, 'GBP', 'EUR', fx, '2024-01-03')).toBeCloseTo(116.666667, 5)
  })

  it('returns null for an unsupported currency', () => {
    expect(convertCurrency(100, 'JPY', 'USD', makeDataset().fx, '2024-01-03')).toBeNull()
  })
})

describe('getMarketContext', () => {
  it('combines the latest VIX, percentile, curve, and benchmark state', () => {
    const context = getMarketContext(makeDataset())
    expect(context.vix).toBe(25)
    expect(context.asOf).toBe('2024-01-05')
    expect(context.percentile.percentile).toBe(100)
    expect(context.termStructure.regime).toBe('backwardation')
    expect(context.benchmark?.ticker).toBe('SPY')
    expect(context.benchmark?.change1dPct).toBeCloseTo((104 / 102 - 1) * 100, 6)
    expect(context.change1d.percent).not.toBeNull()
  })
})
