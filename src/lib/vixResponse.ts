import type { Asset, Peak } from '@/types'

export const VIX_RESPONSE_PEAK_THRESHOLD = 25
export const VIX_RESPONSE_RECOVERY_THRESHOLD = 20

export type MetricSummary = {
  min: number | null
  average: number | null
  max: number | null
}

export type MovingAverageSnapshot = {
  fourWeek: number | null
  thirteenWeek: number | null
  priceVsFourWeekPct: number | null
  priceVsThirteenWeekPct: number | null
}

export type VixResponseStatKey =
  | 'peakVix'
  | 'baselinePrice'
  | 'peakPrice'
  | 'recoveryPrice'
  | 'vixRisePoints'
  | 'vixRisePct'
  | 'stressChangePct'
  | 'drawdownPct'
  | 'responseRatio'
  | 'reboundPct'
  | 'cycleReturnPct'
  | 'daysToVixRecovery'
  | 'daysToBaselineRecovery'
  | 'fourWeekMaAtPeak'
  | 'thirteenWeekMaAtPeak'
  | 'priceVsFourWeekMaAtPeakPct'
  | 'priceVsThirteenWeekMaAtPeakPct'
  | 'fourWeekMaAtRecovery'
  | 'thirteenWeekMaAtRecovery'
  | 'priceVsFourWeekMaAtRecoveryPct'
  | 'priceVsThirteenWeekMaAtRecoveryPct'

export type VixResponseStats = Record<VixResponseStatKey, MetricSummary>

export interface VixResponseEvent {
  peakDate: string
  peakVix: number
  baselineDate: string | null
  baselinePrice: number | null
  baselineVix: number | null
  peakPrice: number
  recoveryDate: string | null
  recoveryPrice: number | null
  recoveryVix: number | null
  daysToVixRecovery: number | null
  vixRisePoints: number | null
  vixRisePct: number | null
  stressChangePct: number | null
  drawdownPct: number | null
  responseRatio: number | null
  reboundPct: number | null
  cycleReturnPct: number | null
  daysToBaselineRecovery: number | null
  peakWeek: string | null
  recoveryWeek: string | null
  peakMovingAverages: MovingAverageSnapshot
  recoveryMovingAverages: MovingAverageSnapshot
}

export interface VixResponseCycle {
  recoveryDate: string | null
  representative: VixResponseEvent
  events: VixResponseEvent[]
  startWeek: string | null
  endWeek: string | null
  positiveRecovery: boolean | null
}

export interface AssetVixResponse {
  events: VixResponseEvent[]
  cycles: VixResponseCycle[]
  stats: VixResponseStats
  eventCount: number
  cycleCount: number
  recoveredCycleCount: number
  positiveRecoveryCount: number
  positiveRecoveryRatePct: number | null
  baselineRecoveryRatePct: number | null
}

export type SensitivityComponentScores = {
  drawdown: number
  rebound: number
  consistency: number
  speed: number
}

export interface RankedVixResponse extends AssetVixResponse {
  asset: Asset
  sensitivityScore: number
  componentScores: SensitivityComponentScores
}

type MovingAveragePeriod = 4 | 13

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function findIndexAtOrBefore(dates: string[], target: string): number {
  for (let index = dates.length - 1; index >= 0; index--) {
    if (dates[index] <= target) return index
  }
  return -1
}

function findIndexAtOrAfter(dates: string[], target: string): number {
  return dates.findIndex((date) => date >= target)
}

function findBaselineIndex(asset: Asset, peakDate: string): number {
  const { dates, price } = asset.priceSeries
  for (let index = dates.length - 1; index >= 0; index--) {
    if (dates[index] < peakDate && isFiniteNumber(price[index])) return index
  }
  return -1
}

function findRecoveryIndex(asset: Asset, recoveryDate: string | null): number {
  if (!recoveryDate) return -1
  const atOrAfter = findIndexAtOrAfter(asset.priceSeries.dates, recoveryDate)
  if (atOrAfter >= 0) return atOrAfter
  return findIndexAtOrBefore(asset.priceSeries.dates, recoveryDate)
}

function movingAverageAt(asset: Asset, index: number, period: MovingAveragePeriod): number | null {
  if (index < period - 1) return null
  const values = asset.priceSeries.price.slice(index - period + 1, index + 1)
  if (values.length !== period || values.some((value) => !isFiniteNumber(value))) return null
  return values.reduce<number>((sum, value) => sum + value!, 0) / period
}

function percentageDistance(value: number | null, reference: number | null): number | null {
  if (!isFiniteNumber(value) || !isFiniteNumber(reference) || reference === 0) return null
  return (value / reference - 1) * 100
}

function movingAverageSnapshot(asset: Asset, index: number, price: number | null): MovingAverageSnapshot {
  const fourWeek = movingAverageAt(asset, index, 4)
  const thirteenWeek = movingAverageAt(asset, index, 13)
  return {
    fourWeek,
    thirteenWeek,
    priceVsFourWeekPct: percentageDistance(price, fourWeek),
    priceVsThirteenWeekPct: percentageDistance(price, thirteenWeek),
  }
}

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const endTime = Date.parse(`${end}T00:00:00Z`)
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000))
}

function getDaysToBaselineRecovery(
  asset: Asset,
  peak: Peak,
  baselinePrice: number | null,
  stressChangePct: number | null,
  peakWeekIndex: number,
  recoveryWeekIndex: number,
): number | null {
  if (
    !isFiniteNumber(baselinePrice) ||
    stressChangePct === null ||
    stressChangePct >= 0 ||
    peakWeekIndex < 0 ||
    recoveryWeekIndex < peakWeekIndex
  ) {
    return null
  }

  const { dates, price } = asset.priceSeries
  for (let index = peakWeekIndex; index <= recoveryWeekIndex; index++) {
    if (isFiniteNumber(price[index]) && price[index]! >= baselinePrice) {
      return daysBetween(peak.vixPeakDate, dates[index])
    }
  }
  return null
}

function buildEvent(asset: Asset, peak: Peak): VixResponseEvent {
  const { dates, vix, price } = asset.priceSeries
  const baselineIndex = findBaselineIndex(asset, peak.vixPeakDate)
  const peakAverageIndex = findIndexAtOrBefore(dates, peak.vixPeakDate)
  const peakWeekIndex = findIndexAtOrAfter(dates, peak.vixPeakDate)
  const effectivePeakWeekIndex =
    peakWeekIndex >= 0 ? peakWeekIndex : findIndexAtOrBefore(dates, peak.vixPeakDate)
  const recoveryWeekIndex = findRecoveryIndex(asset, peak.vixRecoveryDate)

  const baselineDate = baselineIndex >= 0 ? dates[baselineIndex] : null
  const baselinePrice = baselineIndex >= 0 ? price[baselineIndex] : null
  const baselineVix = baselineIndex >= 0 && isFiniteNumber(vix[baselineIndex]) ? vix[baselineIndex] : null
  const recoveryPrice = isFiniteNumber(peak.assetPriceAtRecovery)
    ? peak.assetPriceAtRecovery
    : recoveryWeekIndex >= 0 && isFiniteNumber(price[recoveryWeekIndex])
      ? price[recoveryWeekIndex]
      : null
  const recoveryVix =
    recoveryWeekIndex >= 0 && isFiniteNumber(vix[recoveryWeekIndex]) ? vix[recoveryWeekIndex] : null

  const vixRisePoints = baselineVix === null ? null : peak.vixPeakValue - baselineVix
  const vixRisePct = baselineVix === null || baselineVix === 0 ? null : (vixRisePoints! / baselineVix) * 100
  const stressChangePct =
    !isFiniteNumber(baselinePrice) || baselinePrice === 0
      ? null
      : (peak.assetPriceAtPeak / baselinePrice - 1) * 100
  const drawdownPct = stressChangePct === null ? null : Math.max(0, -stressChangePct)
  const responseRatio =
    stressChangePct === null || vixRisePoints === null || vixRisePoints === 0
      ? null
      : stressChangePct / vixRisePoints
  const reboundPct =
    !peak.vixRecoveryDate || !isFiniteNumber(recoveryPrice) || peak.assetPriceAtPeak === 0
      ? null
      : (recoveryPrice / peak.assetPriceAtPeak - 1) * 100
  const cycleReturnPct =
    !peak.vixRecoveryDate ||
    !isFiniteNumber(recoveryPrice) ||
    !isFiniteNumber(baselinePrice) ||
    baselinePrice === 0
      ? null
      : (recoveryPrice / baselinePrice - 1) * 100
  const daysToVixRecovery = peak.vixRecoveryDate
    ? (peak.daysToRecovery ?? daysBetween(peak.vixPeakDate, peak.vixRecoveryDate))
    : null
  const peakPrice = peak.assetPriceAtPeak
  const peakMaIndex = peakAverageIndex
  const recoveryMaIndex = recoveryWeekIndex
  const peakMovingAverages = movingAverageSnapshot(asset, peakMaIndex, peakPrice)
  const recoveryMovingAverages = movingAverageSnapshot(asset, recoveryMaIndex, recoveryPrice)

  return {
    peakDate: peak.vixPeakDate,
    peakVix: peak.vixPeakValue,
    baselineDate,
    baselinePrice,
    baselineVix,
    peakPrice,
    recoveryDate: peak.vixRecoveryDate,
    recoveryPrice,
    recoveryVix,
    daysToVixRecovery,
    vixRisePoints,
    vixRisePct,
    stressChangePct,
    drawdownPct,
    responseRatio,
    reboundPct,
    cycleReturnPct,
    daysToBaselineRecovery: getDaysToBaselineRecovery(
      asset,
      peak,
      baselinePrice,
      stressChangePct,
      effectivePeakWeekIndex,
      recoveryWeekIndex,
    ),
    peakWeek: effectivePeakWeekIndex >= 0 ? dates[effectivePeakWeekIndex] : null,
    recoveryWeek: recoveryWeekIndex >= 0 ? dates[recoveryWeekIndex] : null,
    peakMovingAverages,
    recoveryMovingAverages,
  }
}

const STAT_KEYS: VixResponseStatKey[] = [
  'peakVix',
  'baselinePrice',
  'peakPrice',
  'recoveryPrice',
  'vixRisePoints',
  'vixRisePct',
  'stressChangePct',
  'drawdownPct',
  'responseRatio',
  'reboundPct',
  'cycleReturnPct',
  'daysToVixRecovery',
  'daysToBaselineRecovery',
  'fourWeekMaAtPeak',
  'thirteenWeekMaAtPeak',
  'priceVsFourWeekMaAtPeakPct',
  'priceVsThirteenWeekMaAtPeakPct',
  'fourWeekMaAtRecovery',
  'thirteenWeekMaAtRecovery',
  'priceVsFourWeekMaAtRecoveryPct',
  'priceVsThirteenWeekMaAtRecoveryPct',
]

function getEventStat(event: VixResponseEvent, key: VixResponseStatKey): number | null {
  switch (key) {
    case 'peakVix':
      return event.peakVix
    case 'baselinePrice':
      return event.baselinePrice
    case 'peakPrice':
      return event.peakPrice
    case 'recoveryPrice':
      return event.recoveryPrice
    case 'vixRisePoints':
      return event.vixRisePoints
    case 'vixRisePct':
      return event.vixRisePct
    case 'stressChangePct':
      return event.stressChangePct
    case 'drawdownPct':
      return event.drawdownPct
    case 'responseRatio':
      return event.responseRatio
    case 'reboundPct':
      return event.reboundPct
    case 'cycleReturnPct':
      return event.cycleReturnPct
    case 'daysToVixRecovery':
      return event.daysToVixRecovery
    case 'daysToBaselineRecovery':
      return event.daysToBaselineRecovery
    case 'fourWeekMaAtPeak':
      return event.peakMovingAverages.fourWeek
    case 'thirteenWeekMaAtPeak':
      return event.peakMovingAverages.thirteenWeek
    case 'priceVsFourWeekMaAtPeakPct':
      return event.peakMovingAverages.priceVsFourWeekPct
    case 'priceVsThirteenWeekMaAtPeakPct':
      return event.peakMovingAverages.priceVsThirteenWeekPct
    case 'fourWeekMaAtRecovery':
      return event.recoveryMovingAverages.fourWeek
    case 'thirteenWeekMaAtRecovery':
      return event.recoveryMovingAverages.thirteenWeek
    case 'priceVsFourWeekMaAtRecoveryPct':
      return event.recoveryMovingAverages.priceVsFourWeekPct
    case 'priceVsThirteenWeekMaAtRecoveryPct':
      return event.recoveryMovingAverages.priceVsThirteenWeekPct
  }
}

function summarize(values: Array<number | null>): MetricSummary {
  const validValues = values.filter(isFiniteNumber)
  if (!validValues.length) return { min: null, average: null, max: null }
  return {
    min: Math.min(...validValues),
    average: validValues.reduce((sum, value) => sum + value, 0) / validValues.length,
    max: Math.max(...validValues),
  }
}

function getCycles(events: VixResponseEvent[]): VixResponseCycle[] {
  const grouped = new Map<string, VixResponseEvent[]>()
  for (const event of events) {
    const key = event.recoveryDate ? `recovered:${event.recoveryDate}` : 'pending'
    grouped.set(key, [...(grouped.get(key) ?? []), event])
  }

  return [...grouped.values()]
    .map((cycleEvents) => {
      const orderedEvents = [...cycleEvents].sort((left, right) =>
        left.peakDate.localeCompare(right.peakDate),
      )
      const representative = [...orderedEvents].sort(
        (left, right) => right.peakVix - left.peakVix || left.peakDate.localeCompare(right.peakDate),
      )[0]
      return {
        recoveryDate: representative.recoveryDate,
        representative,
        events: orderedEvents,
        startWeek: representative.peakWeek,
        endWeek: representative.recoveryWeek,
        positiveRecovery: representative.reboundPct === null ? null : representative.reboundPct > 0,
      }
    })
    .sort((left, right) => left.representative.peakDate.localeCompare(right.representative.peakDate))
}

export function getAssetVixResponse(asset: Asset): AssetVixResponse {
  const events = asset.peaks
    .filter(
      (peak) =>
        peak.vixPeakValue > VIX_RESPONSE_PEAK_THRESHOLD &&
        isFiniteNumber(peak.assetPriceAtPeak) &&
        peak.assetPriceAtPeak > 0,
    )
    .sort((left, right) => left.vixPeakDate.localeCompare(right.vixPeakDate))
    .map((peak) => buildEvent(asset, peak))
  const cycles = getCycles(events)
  const representativeEvents = cycles.map((cycle) => cycle.representative)
  const recoveredCycles = cycles.filter(
    (cycle) => cycle.recoveryDate !== null && cycle.representative.reboundPct !== null,
  )
  const positiveRecoveryCount = recoveredCycles.filter((cycle) => cycle.representative.reboundPct! > 0).length
  const drawdownCycles = recoveredCycles.filter(
    (cycle) => cycle.representative.stressChangePct !== null && cycle.representative.stressChangePct < 0,
  )
  const baselineRecoveredCycles = drawdownCycles.filter(
    (cycle) => cycle.representative.daysToBaselineRecovery !== null,
  ).length

  const stats = Object.fromEntries(
    STAT_KEYS.map((key) => [key, summarize(representativeEvents.map((event) => getEventStat(event, key)))]),
  ) as VixResponseStats

  return {
    events,
    cycles,
    stats,
    eventCount: events.length,
    cycleCount: cycles.length,
    recoveredCycleCount: recoveredCycles.length,
    positiveRecoveryCount,
    positiveRecoveryRatePct:
      recoveredCycles.length > 0 ? (positiveRecoveryCount / recoveredCycles.length) * 100 : null,
    baselineRecoveryRatePct:
      drawdownCycles.length > 0 ? (baselineRecoveredCycles / drawdownCycles.length) * 100 : null,
  }
}

function percentileScore(value: number | null, population: number[], higherIsBetter: boolean): number | null {
  if (value === null || !Number.isFinite(value) || population.length === 0) return null
  if (population.length === 1) return 50
  const sorted = [...population].sort((left, right) => left - right)
  const firstEqualIndex = sorted.findIndex((candidate) => candidate === value)
  if (firstEqualIndex === -1) return null
  let lastEqualIndex = firstEqualIndex
  while (lastEqualIndex + 1 < sorted.length && sorted[lastEqualIndex + 1] === value) lastEqualIndex++
  const rank = ((firstEqualIndex + lastEqualIndex) / 2 / (sorted.length - 1)) * 100
  return higherIsBetter ? rank : 100 - rank
}

function averageDefined(values: Array<number | null>): number {
  const defined = values.filter(isFiniteNumber)
  return defined.length ? defined.reduce((sum, value) => sum + value, 0) / defined.length : 0
}

export function rankVixResponses(assets: Asset[]): RankedVixResponse[] {
  const results = assets.map((asset) => ({ asset, ...getAssetVixResponse(asset) }))
  const scoreInputs = results.map((result) => ({
    drawdown: result.stats.drawdownPct.average,
    rebound: result.stats.reboundPct.average,
    consistency: result.positiveRecoveryRatePct,
    speed: result.stats.daysToBaselineRecovery.average,
  }))
  const drawdowns = scoreInputs.flatMap((input) => (input.drawdown === null ? [] : [input.drawdown]))
  const rebounds = scoreInputs.flatMap((input) => (input.rebound === null ? [] : [input.rebound]))
  const consistencyRates = scoreInputs.flatMap((input) =>
    input.consistency === null ? [] : [input.consistency],
  )
  const recoverySpeeds = scoreInputs.flatMap((input) => (input.speed === null ? [] : [input.speed]))

  return results
    .map((result, index) => {
      const input = scoreInputs[index]
      const componentScores: SensitivityComponentScores = {
        drawdown: percentileScore(input.drawdown, drawdowns, true) ?? 0,
        rebound: percentileScore(input.rebound, rebounds, true) ?? 0,
        consistency: percentileScore(input.consistency, consistencyRates, true) ?? 0,
        speed: percentileScore(input.speed, recoverySpeeds, false) ?? 0,
      }
      const sensitivityScore = averageDefined([
        componentScores.drawdown,
        componentScores.rebound,
        componentScores.consistency,
        componentScores.speed,
      ])
      return { ...result, componentScores, sensitivityScore }
    })
    .sort(
      (left, right) =>
        right.sensitivityScore - left.sensitivityScore ||
        (right.stats.cycleReturnPct.average ?? Number.NEGATIVE_INFINITY) -
          (left.stats.cycleReturnPct.average ?? Number.NEGATIVE_INFINITY) ||
        left.asset.ticker.localeCompare(right.asset.ticker),
    )
}

export function getMovingAverageSeries(asset: Asset, period: MovingAveragePeriod): Array<number | null> {
  return asset.priceSeries.price.map((_, index) => movingAverageAt(asset, index, period))
}
