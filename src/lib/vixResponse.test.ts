import { describe, expect, it } from 'vitest'
import type { Asset, Dataset, Peak } from '@/types'
import dataset from '../../public/data/vix-pulse.json'
import {
  getAssetVixResponse,
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
  it('measures each >25 peak against the prior weekly close and groups shared recoveries', () => {
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

  it('ranks sensitivity using normalized drawdown, rebound, consistency, and recovery speed', () => {
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
    expect(ranked[0].sensitivityScore).toBeGreaterThan(ranked[1].sensitivityScore)
    expect(ranked[0].sensitivityScore).toBeGreaterThanOrEqual(0)
    expect(ranked[0].sensitivityScore).toBeLessThanOrEqual(100)
  })

  it('builds finite VIX response rankings for the checked-in asset dataset', () => {
    const ranked = rankVixResponses((dataset as unknown as Dataset).assets)
    const distinctRecoveryWindows = new Set(
      ranked.flatMap((item) => item.cycles.map((cycle) => cycle.recoveryDate).filter(Boolean)),
    )

    expect(ranked).toHaveLength(66)
    expect(distinctRecoveryWindows.size).toBe(22)
    expect(ranked.every((item) => Number.isFinite(item.sensitivityScore))).toBe(true)
    expect(ranked.every((item) => item.sensitivityScore >= 0 && item.sensitivityScore <= 100)).toBe(true)
    expect(ranked.some((item) => item.stats.daysToBaselineRecovery.average !== null)).toBe(true)
  })
})
