import { describe, expect, it } from 'vitest'
import type { Asset, DailyVixSeries, Dataset, Peak } from '@/types'
import dataset from '../../public/data/vix-pulse.json'
import {
  calculateVixCoMovement,
  getAssetVixResponse,
  computePeaksForAsset,
  getMovingAverageSeries,
  rankVixResponses,
  VIX_RESPONSE_PEAK_THRESHOLD,
} from './vixResponse'

const weeklyDates = [
  '2024-01-05',
  '2024-01-12',
  '2024-01-19',
  '2024-01-26',
  '2024-02-02',
  '2024-02-09',
  '2024-02-16',
  '2024-02-23',
  '2024-03-01',
  '2024-03-08',
  '2024-03-15',
  '2024-03-22',
  '2024-03-29',
]

const weeklyPrices = [100, 95, 80, 90, 100, 105, 110, 108, 112, 115, 118, 120, 123]

const peaks: Peak[] = [
  {
    vixPeakDate: '2024-01-18',
    vixPeakValue: 30,
    assetPriceAtPeak: 85,
    vixRecoveryDate: '2024-01-26',
    assetPriceAtRecovery: 100,
    percentChange: 17.65,
    daysToRecovery: 8,
  },
  {
    vixPeakDate: '2024-01-20',
    vixPeakValue: 35,
    assetPriceAtPeak: 78,
    vixRecoveryDate: '2024-01-26',
    assetPriceAtRecovery: 100,
    percentChange: 28.21,
    daysToRecovery: 6,
  },
  {
    vixPeakDate: '2024-02-06',
    vixPeakValue: VIX_RESPONSE_PEAK_THRESHOLD,
    assetPriceAtPeak: 102,
    vixRecoveryDate: '2024-02-09',
    assetPriceAtRecovery: 105,
    percentChange: 2.94,
    daysToRecovery: 3,
  },
  {
    vixPeakDate: '2024-02-15',
    vixPeakValue: 28,
    assetPriceAtPeak: 109,
    vixRecoveryDate: null,
    assetPriceAtRecovery: null,
    percentChange: null,
    daysToRecovery: null,
  },
]

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    isin: 'TEST00000001',
    ticker: 'TEST',
    name: 'Test Asset',
    type: 'stock',
    currency: 'USD',
    exchange: 'NASDAQ',
    peaks,
    summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
    priceSeries: {
      dates: weeklyDates,
      price: weeklyPrices,
      vix: [17, 20, 33, 19, 18, 17, 16, 18, 19, 21, 20, 18, 17],
      frequency: 'weekly',
    },
    ...overrides,
  }
}

describe('VIX response analytics', () => {
  it('measures each >21 peak against the prior weekly close and groups shared recoveries', () => {
    const response = getAssetVixResponse(makeAsset())

    expect(response.eventCount).toBe(3)
    expect(response.cycleCount).toBe(2)
    expect(response.recoveredCycleCount).toBe(1)
    expect(response.positiveRecoveryRatePct).toBe(100)

    const firstEvent = response.events[0]
    expect(firstEvent.baselineDate).toBe('2024-01-12')
    expect(firstEvent.baselinePrice).toBe(95)
    expect(firstEvent.baselineVix).toBe(20)
    expect(firstEvent.vixRisePoints).toBe(10)
    expect(firstEvent.vixRisePct).toBe(50)
    expect(firstEvent.stressChangePct).toBeCloseTo((85 / 95 - 1) * 100)
    expect(firstEvent.responseRatio).toBeCloseTo(firstEvent.stressChangePct! / 10)
    expect(firstEvent.reboundPct).toBeCloseTo((100 / 85 - 1) * 100)
    expect(firstEvent.cycleReturnPct).toBeCloseTo((100 / 95 - 1) * 100)

    const sharedRecoveryCycle = response.cycles.find((cycle) => cycle.recoveryDate === '2024-01-26')
    expect(sharedRecoveryCycle?.events).toHaveLength(2)
    expect(sharedRecoveryCycle?.representative.peakVix).toBe(35)
    expect(sharedRecoveryCycle?.startWeek).toBe('2024-01-26')
    expect(sharedRecoveryCycle?.endWeek).toBe('2024-01-26')
  })

  it('uses weekly closes to estimate the time an asset takes to regain its baseline', () => {
    const response = getAssetVixResponse(makeAsset())
    const representative = response.cycles.find((cycle) => cycle.recoveryDate === '2024-01-26')!

    expect(representative.representative.daysToBaselineRecovery).toBe(6)
    expect(representative.representative.peakMovingAverages.fourWeek).toBeNull()
    expect(representative.representative.recoveryMovingAverages.fourWeek).toBe(91.25)
  })

  it('uses daily VIX highs, daily closes, and same-date asset closes for report peaks', () => {
    const dailyVix: DailyVixSeries = {
      dates: ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'],
      high: [18, 26, 30, 23, 19],
      close: [17, 24, 28, 21, 19],
    }
    const asset = makeAsset({
      dailyPriceSeries: [100, 98, 90, 95, 100],
    })
    const events = computePeaksForAsset(asset, 21, 20, dailyVix)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      vixPeakDate: '2024-01-10',
      vixPeakValue: 30,
      assetPriceAtPeak: 90,
      vixRecoveryDate: '2024-01-12',
      assetPriceAtRecovery: 100,
      percentChange: 11.11,
      daysToRecovery: 2,
    })
  })

  it('uses the actual VIX recovery close and does not use weekly data after normalization', () => {
    const dates = [
      '2024-01-15',
      '2024-01-16',
      '2024-01-17',
      '2024-01-18',
      '2024-01-19',
      '2024-01-22',
      '2024-01-23',
      '2024-01-24',
      '2024-01-25',
      '2024-01-26',
    ]
    const dailyVix: DailyVixSeries = {
      dates,
      high: [18, 24, 30, 25, 24, 23, 22, 21, 20, 19],
      close: [17, 22, 28, 24, 22, 21, 20.5, 19, 19, 18],
    }
    const asset = makeAsset({
      priceSeries: {
        dates: weeklyDates,
        price: [100, 95, 80, 110, ...weeklyPrices.slice(4)],
        vix: [17, 20, 33, 25, ...Array(weeklyDates.length - 4).fill(18)],
        frequency: 'weekly',
      },
      dailyPriceSeries: [100, 98, 90, 93, 96, 97, 99, 101, 102, 103],
    })

    const response = getAssetVixResponse(asset, 21, 20, false, dailyVix)
    const event = response.events[0]

    expect(response.events).toHaveLength(1)
    expect(event.recoveryDate).toBe('2024-01-24')
    expect(event.recoveryVix).toBe(19)
    expect(event.recoveryWeek).toBe('2024-01-26')
    expect(event.recoveryMovingAverages.fourWeek).toBeNull()
    expect(event.daysToBaselineRecovery).toBeNull()
  })

  it('uses the last weekly asset close on or before a daily VIX event when daily prices are unavailable', () => {
    const dailyVix: DailyVixSeries = {
      dates: ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'],
      high: [18, 26, 30, 23, 19],
      close: [17, 24, 28, 21, 19],
    }
    const events = computePeaksForAsset(makeAsset(), 21, 20, dailyVix)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      vixPeakDate: '2024-01-10',
      assetPriceAtPeak: 100,
      vixRecoveryDate: '2024-01-12',
      assetPriceAtRecovery: 95,
      percentChange: -5,
    })
  })

  it('rebuilds legacy/custom peak rows from daily VIX when the asset has only weekly prices', () => {
    const dailyVix: DailyVixSeries = {
      dates: ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'],
      high: [18, 26, 30, 23, 19],
      close: [17, 24, 28, 21, 19],
    }
    const response = getAssetVixResponse(makeAsset(), 21, 20, true, dailyVix)

    expect(response.eventCount).toBe(1)
    expect(response.events[0].peakDate).toBe('2024-01-10')
    expect(response.events[0].peakPrice).toBe(100)
  })

  it('applies the strict VIX threshold before display rounding', () => {
    const dailyVix: DailyVixSeries = {
      dates: ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'],
      high: [18, 21.0001, 20, 21, 19],
      close: [18, 20.5, 19, 20.5, 19],
    }
    const events = computePeaksForAsset(
      makeAsset({ dailyPriceSeries: [100, 100, 100, 100, 100] }),
      21,
      20,
      dailyVix,
    )

    expect(events).toHaveLength(1)
    expect(events[0].vixPeakDate).toBe('2024-01-09')
    expect(events[0].vixPeakValue).toBe(21.0001)
  })

  it('calculates VIX correlation and return-per-point on common observed sessions only', () => {
    const dailyVix: DailyVixSeries = {
      dates: ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'],
      high: [18, 19, 20, 19, 18],
      close: [18, 19, 20, 19, 18],
    }
    const asset = makeAsset({
      dailyPriceSeries: [100, 110, 121, 108.9, 98.01],
      dailyPriceObserved: [true, true, true, true, true],
    })
    const metrics = calculateVixCoMovement(asset, dailyVix, {
      from: '2024-01-09',
      to: '2024-01-11',
    })

    expect(metrics.observations).toBe(3)
    expect(metrics.correlation).toBeCloseTo(1)
    expect(metrics.returnPctPerVixPoint).toBeCloseTo(10)
  })

  it('averages all individual peaks even when peaks share a recovery cycle', () => {
    const response = getAssetVixResponse(makeAsset())
    const individualReturns = response.events
      .map((event) => event.reboundPct)
      .filter((value): value is number => value !== null)

    expect(response.stats.reboundPct.average).toBeCloseTo(
      individualReturns.reduce((sum, value) => sum + value, 0) / individualReturns.length,
    )
    expect(response.stats.absoluteReboundPct.average).toBeCloseTo(
      individualReturns.reduce((sum, value) => sum + Math.abs(value), 0) / individualReturns.length,
    )
  })

  it('marks a recovered cycle red when the asset did not rise during VIX normalization', () => {
    const declining = makeAsset({
      peaks: peaks.slice(0, 2).map((peak) => ({ ...peak, assetPriceAtRecovery: 70 })),
    })
    const cycle = getAssetVixResponse(declining).cycles[0]

    expect(cycle.representative.reboundPct).toBeLessThan(0)
    expect(cycle.positiveRecovery).toBe(false)
  })

  it('groups unresolved peaks into one pending stress cycle without assigning a recovery result', () => {
    const pendingPeaks = peaks
      .filter((peak) => peak.vixPeakValue > VIX_RESPONSE_PEAK_THRESHOLD)
      .map((peak) => ({
        ...peak,
        vixRecoveryDate: null,
        assetPriceAtRecovery: null,
        percentChange: null,
        daysToRecovery: null,
      }))
    const response = getAssetVixResponse(makeAsset({ peaks: pendingPeaks }))

    expect(response.cycleCount).toBe(1)
    expect(response.cycles[0].events).toHaveLength(3)
    expect(response.cycles[0].positiveRecovery).toBeNull()
    expect(response.recoveredCycleCount).toBe(0)
  })

  it('provides weekly moving-average series and leaves incomplete windows empty', () => {
    const averages = getMovingAverageSeries(makeAsset(), 4)

    expect(averages.slice(0, 3)).toEqual([null, null, null])
    expect(averages[3]).toBe(91.25)
    expect(averages[4]).toBe(91.25)
  })

  it('ranks by signed average peak-to-recovery return and keeps magnitude score separate', () => {
    const asset = makeAsset()
    const sensitive = makeAsset({
      isin: 'TEST00000002',
      ticker: 'SENSITIVE',
      peaks: peaks.map((peak) =>
        peak.vixPeakValue > VIX_RESPONSE_PEAK_THRESHOLD
          ? {
              ...peak,
              assetPriceAtPeak: peak.assetPriceAtPeak * 0.7,
              assetPriceAtRecovery:
                peak.assetPriceAtRecovery === null ? null : peak.assetPriceAtRecovery * 1.5,
            }
          : peak,
      ),
    })
    const ranked = rankVixResponses([asset, sensitive])

    expect(ranked[0].asset.ticker).toBe('SENSITIVE')
    expect(ranked[0].stats.reboundPct.average).toBeGreaterThanOrEqual(ranked[1].stats.reboundPct.average!)
    expect(ranked[0].magnitudeScore).toBeGreaterThan(ranked[1].magnitudeScore)
    expect(ranked[0].magnitudeScore).toBeGreaterThanOrEqual(0)
    expect(ranked[0].magnitudeScore).toBeLessThanOrEqual(100)
  })

  it('builds finite VIX response rankings for the checked-in asset dataset', () => {
    const snapshot = dataset as unknown as Dataset
    const ranked = rankVixResponses(snapshot.assets, VIX_RESPONSE_PEAK_THRESHOLD, 20, snapshot.dailyVix, {
      from: '2025-09-01',
      to: '2026-09-14',
    })
    const distinctRecoveryWindows = new Set(
      ranked.flatMap((item) => item.cycles.map((cycle) => cycle.recoveryDate).filter(Boolean)),
    )

    expect(ranked).toHaveLength(66)
    expect(distinctRecoveryWindows.size).toBeGreaterThan(8)
    expect(ranked.every((item) => Number.isFinite(item.magnitudeScore))).toBe(true)
    expect(ranked.every((item) => item.magnitudeScore >= 0 && item.magnitudeScore <= 100)).toBe(true)
    expect(
      ranked.every(
        (item, index) =>
          index === 0 ||
          (ranked[index - 1].stats.reboundPct.average ?? Number.NEGATIVE_INFINITY) >=
            (item.stats.reboundPct.average ?? Number.NEGATIVE_INFINITY),
      ),
    ).toBe(true)
    expect(ranked.some((item) => item.stats.daysToBaselineRecovery.average !== null)).toBe(true)
    expect(snapshot.dailyVix?.dates.length).toBeGreaterThan(1000)
    expect(
      snapshot.assets.every((asset) => asset.dailyPriceSeries?.length === snapshot.dailyVix?.dates.length),
    ).toBe(true)
    expect(
      snapshot.assets.every((asset) => asset.dailyPriceObserved?.length === snapshot.dailyVix?.dates.length),
    ).toBe(true)
    expect(ranked.every((item) => item.vixCoMovement.observations > 50)).toBe(true)
    const lowestCorrelationAssets = [...ranked].sort(
      (left, right) =>
        Math.abs(left.vixCoMovement.correlation ?? Number.POSITIVE_INFINITY) -
        Math.abs(right.vixCoMovement.correlation ?? Number.POSITIVE_INFINITY),
    )
    const hagCorrelationRank = lowestCorrelationAssets.findIndex((item) => item.asset.ticker === 'HAG') + 1
    expect(hagCorrelationRank).toBeLessThanOrEqual(10)
  })

  it('keeps generated HAG and RHM peak rows identical to the browser daily calculation', () => {
    const snapshot = dataset as unknown as Dataset
    expect(snapshot.dailyVix).toBeDefined()
    for (const isin of ['DE000HAG0005', 'DE0007030009']) {
      const asset = snapshot.assets.find((candidate) => candidate.isin === isin)!
      const computed = computePeaksForAsset(asset, 21, 20, snapshot.dailyVix)
      expect(computed).toEqual(asset.peaks)
    }
  })
})
