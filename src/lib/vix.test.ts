import { describe, expect, it } from 'vitest'
import type { Asset } from '@/types'
import { deriveVixMetrics, getVixRegime, getWeeklyStats, nearestWeeklyDate } from './vix'

const asset: Asset = {
  isin: 'TEST00000001',
  ticker: 'TEST',
  name: 'Test Asset',
  type: 'etf',
  currency: 'USD',
  exchange: 'NYSE',
  peaks: [],
  summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
  priceSeries: {
    dates: ['2026-10-09', '2026-10-16', '2026-10-23'],
    vix: [18.1, 19.99, 19.45],
    price: [100, 102, 101],
    frequency: 'weekly',
  },
}

describe('VIX regimes', () => {
  it('classifies values using common market ranges', () => {
    expect(getVixRegime(14.99).key).toBe('low')
    expect(getVixRegime(15).key).toBe('normal')
    expect(getVixRegime(19.99).key).toBe('normal')
    expect(getVixRegime(20).key).toBe('elevated')
    expect(getVixRegime(29.99).key).toBe('elevated')
    expect(getVixRegime(30).key).toBe('high')
  })

  it('derives metrics from a weekly VIX fallback', () => {
    const metrics = deriveVixMetrics({
      generatedAt: '2026-10-26T00:00:00Z',
      vixThresholdPeak: 21,
      vixThresholdRecovery: 20,
      dateRange: { from: '2026-10-09', to: '2026-10-23' },
      assets: [asset],
    })
    expect(metrics?.currentVix).toBe(19.45)
    expect(metrics?.changeWeekAbs).toBe(-0.54)
    expect(metrics?.changeWeekPct).toBe(-2.7)
  })
})

describe('weekly helpers', () => {
  it('returns latest close and one-week change', () => {
    const stats = getWeeklyStats(asset)
    expect(stats.latest).toBe(101)
    expect(stats.changeAbs).toBe(-1)
    expect(stats.changePct).toBeCloseTo(-0.9804, 3)
  })

  it('finds the nearest weekly date', () => {
    expect(nearestWeeklyDate(asset.priceSeries.dates, '2026-10-21')).toBe('2026-10-23')
    expect(nearestWeeklyDate(asset.priceSeries.dates, '2026-10-16')).toBe('2026-10-16')
  })
})
