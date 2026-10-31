import type { AnalysisDateRange, Asset, DailyVixSeries, Peak } from '@/types'

// Match the supplied report's stated local-high threshold (>21).
export const VIX_RESPONSE_PEAK_THRESHOLD = 21
export const VIX_RESPONSE_RECOVERY_THRESHOLD = 20

function hasCompleteDailyVix(dailyVix?: DailyVixSeries): dailyVix is DailyVixSeries {
  return Boolean(
    dailyVix &&
    dailyVix.dates.length > 0 &&
    dailyVix.high.length === dailyVix.dates.length &&
    dailyVix.close.length === dailyVix.dates.length,
  )
}

function assetPricesOnDates(asset: Asset, dates: string[], dailyVix?: DailyVixSeries): Array<number | null> {
  if (
    hasCompleteDailyVix(dailyVix) &&
    dailyVix.dates.length === dates.length &&
    asset.dailyPriceSeries?.length === dates.length
  ) {
    return asset.dailyPriceSeries
  }
  return dates.map((date) => {
    const index = findIndexAtOrBefore(asset.priceSeries.dates, date)
    const price = index >= 0 ? asset.priceSeries.price[index] : null
    return isFiniteNumber(price) ? price : null
  })
}

export type VixThresholds = {
  peakThreshold: number
  recoveryThreshold: number
}

export function computePeaksForAsset(
  asset: Asset,
  peakThreshold: number = VIX_RESPONSE_PEAK_THRESHOLD,
  recoveryThreshold: number = VIX_RESPONSE_RECOVERY_THRESHOLD,
  dailyVix?: DailyVixSeries,
): Peak[] {
  const hasDailyVix = hasCompleteDailyVix(dailyVix)
  const dates = hasDailyVix ? dailyVix.dates : asset.priceSeries.dates
  const peakVix = hasDailyVix ? dailyVix.high : asset.priceSeries.vix
  const recoveryVix = hasDailyVix ? dailyVix.close : asset.priceSeries.vix
  const price = hasDailyVix ? assetPricesOnDates(asset, dates, dailyVix) : asset.priceSeries.price
  const peaks: Peak[] = []

  for (let i = 1; i < dates.length - 1; i++) {
    const currentVix = peakVix[i]
    if (currentVix === null || currentVix === undefined) continue
    if (currentVix <= peakThreshold) continue
    const prevVix = peakVix[i - 1]
    const nextVix = peakVix[i + 1]
    if (prevVix !== null && prevVix !== undefined && currentVix <= prevVix) continue
    if (nextVix !== null && nextVix !== undefined && currentVix <= nextVix) continue

    const peakPrice = price[i]
    if (peakPrice === null || peakPrice === undefined || peakPrice <= 0) continue

    let recoveryDate: string | null = null
    for (let j = i; j < dates.length; j++) {
      const v = recoveryVix[j]
      if (v !== null && v !== undefined && v < recoveryThreshold) {
        recoveryDate = dates[j]
        break
      }
    }

    if (recoveryDate === null) {
      peaks.push({
        vixPeakDate: dates[i],
        vixPeakValue: Number(currentVix.toFixed(4)),
        assetPriceAtPeak: Number(peakPrice.toFixed(4)),
        vixRecoveryDate: null,
        assetPriceAtRecovery: null,
        percentChange: null,
        daysToRecovery: null,
      })
      continue
    }

    const recoveryIndex = dates.indexOf(recoveryDate)
    if (recoveryIndex < 0) {
      peaks.push({
        vixPeakDate: dates[i],
        vixPeakValue: Number(currentVix.toFixed(4)),
        assetPriceAtPeak: Number(peakPrice.toFixed(4)),
        vixRecoveryDate: null,
        assetPriceAtRecovery: null,
        percentChange: null,
        daysToRecovery: null,
      })
      continue
    }

    const recoveryPrice = price[recoveryIndex]
    if (recoveryPrice === null || recoveryPrice === undefined) {
      peaks.push({
        vixPeakDate: dates[i],
        vixPeakValue: Number(currentVix.toFixed(4)),
        assetPriceAtPeak: Number(peakPrice.toFixed(4)),
        vixRecoveryDate: null,
        assetPriceAtRecovery: null,
        percentChange: null,
        daysToRecovery: null,
      })
      continue
    }

    const percentChange = ((recoveryPrice - peakPrice) / peakPrice) * 100
    const daysToRecovery = Math.max(
      0,
      Math.round((Date.parse(`${recoveryDate}T00:00:00Z`) - Date.parse(`${dates[i]}T00:00:00Z`)) / 86400000),
    )

    peaks.push({
      vixPeakDate: dates[i],
      vixPeakValue: Number(currentVix.toFixed(4)),
      assetPriceAtPeak: Number(peakPrice.toFixed(4)),
      vixRecoveryDate: recoveryDate,
      assetPriceAtRecovery: Number(recoveryPrice.toFixed(4)),
      percentChange: Number(percentChange.toFixed(2)),
      daysToRecovery,
    })
  }

  return peaks.sort((a, b) => a.vixPeakDate.localeCompare(b.vixPeakDate))
}

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
  | 'absoluteReboundPct'
  | 'avgRateToNextPeak'
  | 'avgDaysTo10Pct'
  | 'avgDaysTo15Pct'
  | 'avgDaysTo20Pct'
  | 'avgDaysTo25Pct'

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
  rateToNextVixPeakPctPerDay: number | null
  daysTo10Pct: number | null
  daysTo15Pct: number | null
  daysTo20Pct: number | null
  daysTo25Pct: number | null
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
  recoveredEventCount: number
  positiveRecoveryCount: number
  positiveRecoveryRatePct: number | null
  baselineRecoveryRatePct: number | null
}

export type MagnitudeComponentScores = {
  absolutePriceMove: number
}

export type VixCoMovement = {
  /** Pearson correlation of daily asset returns with daily VIX point changes. */
  correlation: number | null
  /** Linear response in asset-return percent per one VIX point change. */
  returnPctPerVixPoint: number | null
  observations: number
}

export interface RankedVixResponse extends AssetVixResponse {
  asset: Asset
  magnitudeScore: number
  componentScores: MagnitudeComponentScores
  vixCoMovement: VixCoMovement
}

type MovingAveragePeriod = 4 | 13

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function calculateVixCoMovement(
  asset: Asset,
  dailyVix?: DailyVixSeries,
  dateRange?: AnalysisDateRange,
): VixCoMovement {
  if (
    !hasCompleteDailyVix(dailyVix) ||
    asset.dailyPriceSeries?.length !== dailyVix.dates.length ||
    asset.dailyPriceObserved?.length !== dailyVix.dates.length
  ) {
    return { correlation: null, returnPctPerVixPoint: null, observations: 0 }
  }

  const priceReturns: number[] = []
  const vixChanges: number[] = []
  for (let index = 1; index < dailyVix.dates.length; index++) {
    const date = dailyVix.dates[index]
    if ((dateRange?.from && date < dateRange.from) || (dateRange?.to && date > dateRange.to)) continue
    if (!asset.dailyPriceObserved[index] || !asset.dailyPriceObserved[index - 1]) continue

    const previousPrice = asset.dailyPriceSeries[index - 1]
    const currentPrice = asset.dailyPriceSeries[index]
    const previousVix = dailyVix.close[index - 1]
    const currentVix = dailyVix.close[index]
    if (!isFiniteNumber(previousPrice) || previousPrice <= 0 || !isFiniteNumber(currentPrice)) continue
    if (!isFiniteNumber(previousVix) || !isFiniteNumber(currentVix)) continue

    priceReturns.push((currentPrice / previousPrice - 1) * 100)
    vixChanges.push(currentVix - previousVix)
  }

  const observations = priceReturns.length
  if (observations < 2) {
    return { correlation: null, returnPctPerVixPoint: null, observations }
  }

  const meanReturn = priceReturns.reduce((sum, value) => sum + value, 0) / observations
  const meanVixChange = vixChanges.reduce((sum, value) => sum + value, 0) / observations
  let covariance = 0
  let returnVariance = 0
  let vixVariance = 0
  for (let index = 0; index < observations; index++) {
    const returnDeviation = priceReturns[index] - meanReturn
    const vixDeviation = vixChanges[index] - meanVixChange
    covariance += returnDeviation * vixDeviation
    returnVariance += returnDeviation * returnDeviation
    vixVariance += vixDeviation * vixDeviation
  }

  const returnPctPerVixPoint = vixVariance > 0 ? covariance / vixVariance : null
  const correlation =
    returnVariance > 0 && vixVariance > 0
      ? Math.max(-1, Math.min(1, covariance / Math.sqrt(returnVariance * vixVariance)))
      : null
  return { correlation, returnPctPerVixPoint, observations }
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

function findRecoveryMetricsIndex(asset: Asset, recoveryDate: string | null): number {
  if (!recoveryDate) return -1
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

function findNextVixPeakIndex(
  dates: string[],
  vix: Array<number | null>,
  currentDate: string,
  peakThreshold: number,
): number {
  const currentIndex = dates.indexOf(currentDate)
  if (currentIndex < 0) {
    const atOrAfter = dates.findIndex((d) => d >= currentDate)
    if (atOrAfter < 0) return -1
    for (let i = atOrAfter + 1; i < dates.length - 1; i++) {
      const currentVix = vix[i]
      if (currentVix === null || currentVix === undefined) continue
      if (currentVix <= peakThreshold) continue
      const prevVix = vix[i - 1]
      const nextVix = vix[i + 1]
      if (prevVix !== null && prevVix !== undefined && currentVix <= prevVix) continue
      if (nextVix !== null && nextVix !== undefined && currentVix <= nextVix) continue
      return i
    }
    return -1
  }
  for (let i = currentIndex + 1; i < dates.length - 1; i++) {
    const currentVix = vix[i]
    if (currentVix === null || currentVix === undefined) continue
    if (currentVix <= peakThreshold) continue
    const prevVix = vix[i - 1]
    const nextVix = vix[i + 1]
    if (prevVix !== null && prevVix !== undefined && currentVix <= prevVix) continue
    if (nextVix !== null && nextVix !== undefined && currentVix <= nextVix) continue
    return i
  }
  return -1
}

function daysToTargetIncrease(
  dates: string[],
  price: Array<number | null>,
  startIndex: number,
  startPrice: number,
  targetPct: number,
): number | null {
  if (startIndex < 0 || startPrice <= 0) return null
  const targetPrice = startPrice * (1 + targetPct / 100)
  for (let i = startIndex; i < price.length; i++) {
    const p = price[i]
    if (isFiniteNumber(p) && p >= targetPrice) {
      return daysBetween(dates[startIndex], dates[i])
    }
  }
  return null
}

function buildEvent(
  asset: Asset,
  peak: Peak,
  peakThreshold: number,
  dailyVix?: DailyVixSeries,
  endDate?: string,
): VixResponseEvent {
  const { dates, vix, price } = asset.priceSeries
  const baselineIndex = findBaselineIndex(asset, peak.vixPeakDate)
  const peakAverageIndex = findIndexAtOrBefore(dates, peak.vixPeakDate)
  const peakWeekIndex = findIndexAtOrAfter(dates, peak.vixPeakDate)
  const effectivePeakWeekIndex =
    peakWeekIndex >= 0 ? peakWeekIndex : findIndexAtOrBefore(dates, peak.vixPeakDate)
  const recoveryWeekIndex = findRecoveryIndex(asset, peak.vixRecoveryDate)
  // Metrics measured at normalization must not include a later weekly close.
  const recoveryMetricsIndex = findRecoveryMetricsIndex(asset, peak.vixRecoveryDate)

  const baselineDate = baselineIndex >= 0 ? dates[baselineIndex] : null
  const baselinePrice = baselineIndex >= 0 ? price[baselineIndex] : null
  const baselineVix = baselineIndex >= 0 && isFiniteNumber(vix[baselineIndex]) ? vix[baselineIndex] : null
  const recoveryPrice = isFiniteNumber(peak.assetPriceAtRecovery)
    ? peak.assetPriceAtRecovery
    : recoveryWeekIndex >= 0 && isFiniteNumber(price[recoveryWeekIndex])
      ? price[recoveryWeekIndex]
      : null
  const recoveryVixIndex = peak.vixRecoveryDate
    ? hasCompleteDailyVix(dailyVix)
      ? findIndexAtOrBefore(dailyVix.dates, peak.vixRecoveryDate)
      : recoveryMetricsIndex
    : -1
  const recoveryVix = hasCompleteDailyVix(dailyVix)
    ? recoveryVixIndex >= 0 && isFiniteNumber(dailyVix.close[recoveryVixIndex])
      ? dailyVix.close[recoveryVixIndex]
      : null
    : recoveryVixIndex >= 0 && isFiniteNumber(vix[recoveryVixIndex])
      ? vix[recoveryVixIndex]
      : null

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
  const recoveryMaIndex = recoveryMetricsIndex
  const peakMovingAverages = movingAverageSnapshot(asset, peakMaIndex, peakPrice)
  const recoveryMovingAverages = movingAverageSnapshot(asset, recoveryMaIndex, recoveryPrice)

  const hasDailyVix = hasCompleteDailyVix(dailyVix)
  const unboundedFactorDates = hasDailyVix ? dailyVix.dates : dates
  const unboundedFactorPrices = hasDailyVix
    ? assetPricesOnDates(asset, unboundedFactorDates, dailyVix)
    : price
  const unboundedFactorVix = hasDailyVix ? dailyVix.high : vix
  const factorEndIndex = endDate
    ? findIndexAtOrBefore(unboundedFactorDates, endDate)
    : unboundedFactorDates.length - 1
  const factorDates = unboundedFactorDates.slice(0, factorEndIndex + 1)
  const factorPrices = unboundedFactorPrices.slice(0, factorEndIndex + 1)
  const factorVix = unboundedFactorVix.slice(0, factorEndIndex + 1)
  const factorStartIndex = findIndexAtOrAfter(factorDates, peak.vixPeakDate)

  // Factor 1: calendar-day rate of price change from this peak to the next
  // local VIX peak above the selected threshold.
  const nextPeakIndex = findNextVixPeakIndex(factorDates, factorVix, peak.vixPeakDate, peakThreshold)
  let rateToNextVixPeakPctPerDay: number | null = null
  if (
    nextPeakIndex >= 0 &&
    factorStartIndex >= 0 &&
    isFiniteNumber(factorPrices[factorStartIndex]) &&
    factorPrices[factorStartIndex]! > 0
  ) {
    const nextPrice = factorPrices[nextPeakIndex]
    if (isFiniteNumber(nextPrice)) {
      const pctChange = (nextPrice / factorPrices[factorStartIndex]! - 1) * 100
      const elapsedDays = daysBetween(factorDates[factorStartIndex], factorDates[nextPeakIndex])
      if (elapsedDays > 0) {
        rateToNextVixPeakPctPerDay = pctChange / elapsedDays
      }
    }
  }

  // Factor 2: days to reach 10%, 15%, 20%, 25% increase from peak
  const daysTo10Pct = daysToTargetIncrease(factorDates, factorPrices, factorStartIndex, peakPrice, 10)
  const daysTo15Pct = daysToTargetIncrease(factorDates, factorPrices, factorStartIndex, peakPrice, 15)
  const daysTo20Pct = daysToTargetIncrease(factorDates, factorPrices, factorStartIndex, peakPrice, 20)
  const daysTo25Pct = daysToTargetIncrease(factorDates, factorPrices, factorStartIndex, peakPrice, 25)

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
      recoveryMetricsIndex,
    ),
    peakWeek: effectivePeakWeekIndex >= 0 ? dates[effectivePeakWeekIndex] : null,
    recoveryWeek: recoveryWeekIndex >= 0 ? dates[recoveryWeekIndex] : null,
    peakMovingAverages,
    recoveryMovingAverages,
    rateToNextVixPeakPctPerDay,
    daysTo10Pct,
    daysTo15Pct,
    daysTo20Pct,
    daysTo25Pct,
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
  'avgRateToNextPeak',
  'avgDaysTo10Pct',
  'avgDaysTo15Pct',
  'avgDaysTo20Pct',
  'avgDaysTo25Pct',
  'absoluteReboundPct',
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
    case 'avgRateToNextPeak':
      return event.rateToNextVixPeakPctPerDay
    case 'avgDaysTo10Pct':
      return event.daysTo10Pct
    case 'avgDaysTo15Pct':
      return event.daysTo15Pct
    case 'avgDaysTo20Pct':
      return event.daysTo20Pct
    case 'avgDaysTo25Pct':
      return event.daysTo25Pct
    case 'absoluteReboundPct':
      return event.reboundPct === null ? null : Math.abs(event.reboundPct)
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

export function getAssetVixResponse(
  asset: Asset,
  peakThreshold: number = VIX_RESPONSE_PEAK_THRESHOLD,
  recoveryThreshold: number = VIX_RESPONSE_RECOVERY_THRESHOLD,
  useStoredPeaks: boolean = true,
  dailyVix?: DailyVixSeries,
  dateRange?: AnalysisDateRange,
): AssetVixResponse {
  const canUseStoredPeaks =
    useStoredPeaks &&
    peakThreshold >= VIX_RESPONSE_PEAK_THRESHOLD &&
    recoveryThreshold === VIX_RESPONSE_RECOVERY_THRESHOLD &&
    (!hasCompleteDailyVix(dailyVix) || asset.dailyPriceSeries?.length === dailyVix.dates.length) &&
    Array.isArray(asset.peaks) &&
    asset.peaks.length > 0
  const peaks = canUseStoredPeaks
    ? asset.peaks
        .filter(
          (peak) =>
            peak.vixPeakValue > peakThreshold &&
            isFiniteNumber(peak.assetPriceAtPeak) &&
            peak.assetPriceAtPeak > 0,
        )
        .sort((left, right) => left.vixPeakDate.localeCompare(right.vixPeakDate))
    : computePeaksForAsset(asset, peakThreshold, recoveryThreshold, dailyVix).filter(
        (peak) =>
          peak.vixPeakValue > peakThreshold &&
          isFiniteNumber(peak.assetPriceAtPeak) &&
          peak.assetPriceAtPeak > 0,
      )
  const rangedPeaks = peaks
    .filter(
      (peak) =>
        (!dateRange?.from || peak.vixPeakDate >= dateRange.from) &&
        (!dateRange?.to || peak.vixPeakDate <= dateRange.to),
    )
    .map((peak) => {
      if (!dateRange?.to || !peak.vixRecoveryDate || peak.vixRecoveryDate <= dateRange.to) return peak
      return {
        ...peak,
        vixRecoveryDate: null,
        assetPriceAtRecovery: null,
        percentChange: null,
        daysToRecovery: null,
      }
    })
  const events = rangedPeaks.map((peak) => buildEvent(asset, peak, peakThreshold, dailyVix, dateRange?.to))
  const cycles = getCycles(events)
  const recoveredEvents = events.filter((event) => event.recoveryDate !== null && event.reboundPct !== null)
  const positiveRecoveryCount = recoveredEvents.filter((event) => event.reboundPct! > 0).length
  const drawdownEvents = recoveredEvents.filter(
    (event) => event.stressChangePct !== null && event.stressChangePct < 0,
  )
  const baselineRecoveredEvents = drawdownEvents.filter(
    (event) => event.daysToBaselineRecovery !== null,
  ).length

  const stats = Object.fromEntries(
    STAT_KEYS.map((key) => [key, summarize(events.map((event) => getEventStat(event, key)))]),
  ) as VixResponseStats

  return {
    events,
    cycles,
    stats,
    eventCount: events.length,
    cycleCount: cycles.length,
    recoveredCycleCount: cycles.filter((cycle) => cycle.recoveryDate !== null).length,
    recoveredEventCount: recoveredEvents.length,
    positiveRecoveryCount,
    positiveRecoveryRatePct:
      recoveredEvents.length > 0 ? (positiveRecoveryCount / recoveredEvents.length) * 100 : null,
    baselineRecoveryRatePct:
      drawdownEvents.length > 0 ? (baselineRecoveredEvents / drawdownEvents.length) * 100 : null,
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

export function rankVixResponses(
  assets: Asset[],
  peakThreshold: number = VIX_RESPONSE_PEAK_THRESHOLD,
  recoveryThreshold: number = VIX_RESPONSE_RECOVERY_THRESHOLD,
  dailyVix?: DailyVixSeries,
  dateRange?: AnalysisDateRange,
): RankedVixResponse[] {
  const results = assets.map((asset) => ({
    asset,
    ...getAssetVixResponse(asset, peakThreshold, recoveryThreshold, true, dailyVix, dateRange),
    vixCoMovement: calculateVixCoMovement(asset, dailyVix, dateRange),
  }))
  const absoluteMoves = results.flatMap((result) =>
    result.stats.absoluteReboundPct.average === null ? [] : [result.stats.absoluteReboundPct.average],
  )

  return results
    .map((result) => {
      const componentScores: MagnitudeComponentScores = {
        absolutePriceMove: percentileScore(result.stats.absoluteReboundPct.average, absoluteMoves, true) ?? 0,
      }
      const magnitudeScore = componentScores.absolutePriceMove
      return { ...result, componentScores, magnitudeScore }
    })
    .sort(
      (left, right) =>
        (right.stats.reboundPct.average ?? Number.NEGATIVE_INFINITY) -
          (left.stats.reboundPct.average ?? Number.NEGATIVE_INFINITY) ||
        left.asset.ticker.localeCompare(right.asset.ticker),
    )
}

export function getMovingAverageSeries(asset: Asset, period: MovingAveragePeriod): Array<number | null> {
  return asset.priceSeries.price.map((_, index) => movingAverageAt(asset, index, period))
}

/** Daily equivalent of a 4W/13W average, using five trading sessions per week. */
export function getDailyMovingAverageSeries(asset: Asset, period: MovingAveragePeriod): Array<number | null> {
  const prices = asset.dailyPriceSeries
  if (!prices) return getMovingAverageSeries(asset, period)
  const window = period * 5
  return prices.map((_, index) => {
    if (index < window - 1) return null
    const values = prices.slice(index - window + 1, index + 1)
    if (values.some((value) => !isFiniteNumber(value))) return null
    return values.reduce<number>((sum, value) => sum + value!, 0) / window
  })
}
