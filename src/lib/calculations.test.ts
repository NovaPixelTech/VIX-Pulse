import { describe, it, expect } from 'vitest'
import { findVixPeaks, findRecoveryDate, calculatePercentChange, calculateDaysBetween, calculateAssetSummary } from './calculations'

describe('VIX Calculations', () => {
  it('finds VIX peaks correctly', () => {
    const vixData = [
      { date: '2020-03-01', high: 20, close: 19 },
      { date: '2020-03-02', high: 25, close: 24 },
      { date: '2020-03-03', high: 30, close: 28 },
      { date: '2020-03-04', high: 28, close: 22 },
      { date: '2020-03-05', high: 25, close: 18 },
    ]
    const peaks = findVixPeaks(vixData)
    expect(peaks.length).toBe(1)
    expect(peaks[0].high).toBe(30)
    expect(peaks[0].date).toBe('2020-03-03')
  })

  it('finds recovery date', () => {
    const vixData = [
      { date: '2020-03-01', high: 20, close: 30 },
      { date: '2020-03-02', high: 35, close: 32 },
      { date: '2020-03-03', high: 40, close: 25 },
      { date: '2020-03-04', high: 30, close: 18 },
    ]
    const recovery = findRecoveryDate(vixData, 2)
    expect(recovery).toBe('2020-03-04')
  })

  it('calculates percent change', () => {
    const pct = calculatePercentChange(100, 110)
    expect(pct).toBe(10)
  })

  it('calculates days between', () => {
    const days = calculateDaysBetween('2020-03-01', '2020-03-05')
    expect(days).toBe(4)
  })

  it('calculates asset summary', () => {
    const peaks = [
      { vixPeakDate: '2020-03-01', vixPeakValue: 30, assetPriceAtPeak: 100, vixRecoveryDate: '2020-03-05', assetPriceAtRecovery: 110, percentChange: 10, daysToRecovery: 4 },
      { vixPeakDate: '2020-04-01', vixPeakValue: 35, assetPriceAtPeak: 120, vixRecoveryDate: '2020-04-08', assetPriceAtRecovery: 126, percentChange: 5, daysToRecovery: 7 },
    ]
    const summary = calculateAssetSummary(peaks)
    expect(summary.meanChange).toBe(7.5)
    expect(summary.maxChange).toBe(10)
    expect(summary.meanDays).toBe(5.5)
    expect(summary.meanVix).toBe(32.5)
  })
})
