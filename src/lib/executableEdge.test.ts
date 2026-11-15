import { describe, expect, it } from 'vitest'
import type { Asset, Dataset } from '@/types'
import {
  buildExecutableTrades,
  rankExecutableEdges,
  summarizeExecutableEdge,
  type ExecutableEdgeOptions,
} from './executableEdge'

function dateAt(index: number): string {
  const date = new Date(Date.UTC(2024, 0, 1 + index))
  return date.toISOString().slice(0, 10)
}

function makeAsset({
  prices,
  currency = 'USD',
  ticker = 'TEST',
  isin = 'TEST-ISIN',
}: {
  prices: Array<number | null>
  currency?: string
  ticker?: string
  isin?: string
}): Asset {
  const dates = prices.map((_, index) => dateAt(index))
  return {
    isin,
    ticker,
    name: ticker,
    type: 'etf',
    currency,
    exchange: 'TEST',
    peaks: [],
    summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
    priceSeries: { dates, vix: prices.map(() => 20), price: prices },
    dailyPriceSeries: prices,
    dailyPriceObserved: prices.map((price) => price !== null),
  }
}

function makeDataset({
  vix,
  prices,
  benchmark,
  eurusd,
  currency = 'USD',
}: {
  vix: number[]
  prices: Array<number | null>
  benchmark: Array<number | null>
  eurusd?: Array<number | null>
  currency?: string
}): Dataset {
  const dates = vix.map((_, index) => dateAt(index))
  return {
    generatedAt: '2024-01-01T00:00:00Z',
    vixThresholdPeak: 21,
    vixThresholdRecovery: 20,
    dateRange: { from: dates[0], to: dates[dates.length - 1] },
    vixMetrics: {
      currentVix: vix[vix.length - 1],
      currentDate: dates[dates.length - 1],
      previousDayVix: vix[vix.length - 2],
      previousDayDate: dates[dates.length - 2],
      changeDayAbs: 0,
      changeDayPct: 0,
      latestWeekVix: vix[vix.length - 1],
      latestWeekDate: dates[dates.length - 1],
      previousWeekVix: vix[vix.length - 2],
      previousWeekDate: dates[dates.length - 2],
      changeWeekAbs: 0,
      changeWeekPct: 0,
    },
    dailyVix: {
      dates,
      high: vix,
      close: vix,
    },
    benchmark: {
      ticker: 'SPY',
      name: 'SPY',
      currency: 'USD',
      dates,
      close: benchmark,
    },
    fx: {
      dates,
      EURUSD: eurusd ?? dates.map(() => 1),
      GBPUSD: dates.map(() => 1),
    },
    assets: [makeAsset({ prices, currency })],
  }
}

const BASE_OPTIONS: ExecutableEdgeOptions = {
  peakThreshold: 21,
  recoveryThreshold: 20,
  stopLossPct: 0,
  maxHoldingDays: 100,
  costBps: 0,
  baseCurrency: 'USD',
  bootstrapSamples: 500,
}

describe('buildExecutableTrades', () => {
  it('enters at the next observed close after VIX crosses above the threshold and exits after recovery', () => {
    const dataset = makeDataset({
      vix: [18, 18, 22, 25, 23, 19, 18],
      prices: [100, 100, 100, 100, 105, 108, 110],
      benchmark: [100, 100, 100, 100, 100, 100, 100],
    })

    const trades = buildExecutableTrades(dataset, dataset.assets[0], BASE_OPTIONS)
    expect(trades).toHaveLength(1)
    expect(trades[0].signalDate).toBe(dateAt(2))
    expect(trades[0].entryDate).toBe(dateAt(3))
    expect(trades[0].exitDate).toBe(dateAt(6))
    expect(trades[0].exitReason).toBe('vix-recovery')
    expect(trades[0].netReturnPct).toBeCloseTo(10, 6)
    expect(trades[0].excessReturnPct).toBeCloseTo(10, 6)
  })

  it('exits on a close-based stop loss before VIX recovers', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 24, 23, 22],
      prices: [100, 100, 100, 85, 90, 95],
      benchmark: [100, 100, 100, 100, 100, 100],
    })

    const trades = buildExecutableTrades(dataset, dataset.assets[0], {
      ...BASE_OPTIONS,
      stopLossPct: 10,
    })
    expect(trades).toHaveLength(1)
    expect(trades[0].exitReason).toBe('stop-loss')
    expect(trades[0].exitDate).toBe(dateAt(3))
    expect(trades[0].netReturnPct).toBeCloseTo(-15, 6)
    expect(trades[0].maePct).toBeCloseTo(-15, 6)
  })

  it('exits at the maximum holding period when VIX stays elevated', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 24, 23, 22, 24, 25, 24],
      prices: [100, 100, 100, 101, 102, 103, 104, 105, 106],
      benchmark: [100, 100, 100, 100, 100, 100, 100, 100, 100],
    })

    const trades = buildExecutableTrades(dataset, dataset.assets[0], {
      ...BASE_OPTIONS,
      maxHoldingDays: 2,
    })
    expect(trades).toHaveLength(1)
    expect(trades[0].exitReason).toBe('max-holding')
    expect(trades[0].holdingBars).toBe(2)
    expect(trades[0].exitDate).toBe(dateAt(4))
  })

  it('applies round-trip costs to both the asset and the benchmark', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 19, 18],
      prices: [100, 100, 100, 110, 110],
      benchmark: [100, 100, 100, 104, 104],
    })

    const withoutCosts = buildExecutableTrades(dataset, dataset.assets[0], BASE_OPTIONS)[0]
    const withCosts = buildExecutableTrades(dataset, dataset.assets[0], {
      ...BASE_OPTIONS,
      costBps: 50,
    })[0]

    expect(withoutCosts.netReturnPct).toBeCloseTo(10, 6)
    expect(withCosts.netReturnPct).toBeCloseTo((1.1 * 0.995 ** 2 - 1) * 100, 6)
    expect(withCosts.benchmarkNetReturnPct).toBeCloseTo((1.04 * 0.995 ** 2 - 1) * 100, 6)
    expect(withCosts.excessReturnPct).toBeCloseTo(0.995 ** 2 * withoutCosts.excessReturnPct, 6)
  })

  it('converts EUR returns into the selected base currency', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 23, 19, 18],
      prices: [100, 100, 100, 100, 100, 100],
      benchmark: [100, 100, 100, 100, 100, 100],
      eurusd: [1, 1, 1, 1.1, 1.1, 1.2],
      currency: 'EUR',
    })

    const trades = buildExecutableTrades(dataset, dataset.assets[0], BASE_OPTIONS)
    expect(trades).toHaveLength(1)
    expect(trades[0].entryPriceBase).toBeCloseTo(100, 6)
    expect(trades[0].exitPriceBase).toBeCloseTo(120, 6)
    expect(trades[0].netReturnPct).toBeCloseTo(20, 6)
    expect(trades[0].excessReturnPct).toBeCloseTo(20, 6)
  })

  it('does not open overlapping trades', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 24, 22, 24, 25, 19, 18, 22, 25, 19, 18],
      prices: [100, 100, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
      benchmark: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    })

    const trades = buildExecutableTrades(dataset, dataset.assets[0], BASE_OPTIONS)
    for (let index = 1; index < trades.length; index += 1) {
      expect(trades[index].entryDate >= trades[index - 1].exitDate).toBe(true)
    }
  })
})

describe('summarizeExecutableEdge', () => {
  it('reports benchmark-relative statistics and a bootstrap interval', () => {
    const vix = [18]
    const prices = [100]
    const benchmark = [100]
    for (let cycle = 0; cycle < 4; cycle += 1) {
      vix.push(22, 25, 19, 18)
      prices.push(100, 100 + cycle * 2, 104 + cycle * 2, 105 + cycle * 2)
      benchmark.push(100, 100, 101, 101)
    }
    const dataset = makeDataset({ vix, prices, benchmark })
    const result = summarizeExecutableEdge(dataset, dataset.assets[0], BASE_OPTIONS)

    expect(result.sampleSize).toBeGreaterThanOrEqual(3)
    expect(result.meanExcessReturnPct).not.toBeNull()
    expect(result.ci95Low).not.toBeNull()
    expect(result.ci95High).not.toBeNull()
    expect(result.ci95Low! <= result.ci95High!).toBe(true)
    expect(result.meanNetReturnPct).toBeGreaterThan(result.meanExcessReturnPct ?? 0)
    expect(result.exposurePct).toBeGreaterThan(0)
  })

  it('ranks assets with a usable history ahead of assets without one', () => {
    const dataset = makeDataset({
      vix: [18, 22, 25, 19, 18, 22, 25, 19, 18, 22, 25, 19, 18],
      prices: [100, 100, 100, 106, 107, 107, 107, 113, 114, 114, 114, 120, 121],
      benchmark: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    })
    dataset.assets.push(
      makeAsset({
        prices: dataset.dailyVix!.dates.map(() => null),
        ticker: 'EMPTY',
        isin: 'EMPTY-ISIN',
      }),
    )

    const ranked = rankExecutableEdges(dataset, BASE_OPTIONS)
    expect(ranked[0].ticker).toBe('TEST')
    expect(ranked[0].sampleSize).toBeGreaterThanOrEqual(3)
    expect(ranked[1].sampleSize).toBe(0)
  })
})
