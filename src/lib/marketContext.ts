import type { Dataset, DailyVixSeries, FxSeries, TermStructureSeries } from '@/types'
import { getVixRegime, type VixRegime } from '@/lib/vix'

const TRADING_DAYS_PER_YEAR = 252
export const DEFAULT_VIX_PERCENTILE_LOOKBACK = 756

export type TermStructureRegime = 'contango' | 'flat' | 'backwardation'

export interface VixPercentileSnapshot {
  value: number | null
  percentile: number | null
  observations: number
  lookback: number
  from: string | null
  to: string | null
}

export interface VixChangeSnapshot {
  absolute: number | null
  percent: number | null
}

export interface TermStructureSnapshot {
  date: string | null
  vix: number | null
  vix9d: number | null
  vix3m: number | null
  vix6m: number | null
  /** VIX9D / VIX. Above 1 means the shortest-dated contract is the most expensive. */
  shortRatio: number | null
  /** VIX / VIX3M. Above 1 is backwardation; below 1 is contango. */
  frontRatio: number | null
  /** (VIX3M / VIX - 1) × 100. Positive means the curve slopes upward. */
  slopePct: number | null
  regime: TermStructureRegime | null
}

export interface BenchmarkSnapshot {
  ticker: string
  name: string
  lastClose: number | null
  lastDate: string | null
  change1dPct: number | null
  change5dPct: number | null
  realizedVol20dPct: number | null
}

export interface MarketContextSnapshot {
  asOf: string | null
  vix: number | null
  vixRegime: VixRegime
  change1d: VixChangeSnapshot
  change5d: VixChangeSnapshot
  percentile: VixPercentileSnapshot
  termStructure: TermStructureSnapshot
  benchmark: BenchmarkSnapshot | null
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function lastValidIndex(values: ReadonlyArray<number | null | undefined>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (isFiniteNumber(values[index])) return index
  }
  return -1
}

function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) return null
  return numerator / denominator
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0
  let atOrBelow = 0
  let equal = 0
  for (const candidate of values) {
    if (candidate < value) atOrBelow += 1
    else if (candidate === value) equal += 1
  }
  // A flat series has no meaningful percentile; keep it at the midpoint.
  if (equal === values.length) return 50
  // Otherwise use the empirical CDF so a new high reads as the 100th percentile.
  return ((atOrBelow + equal) / values.length) * 100
}

export function getVixPercentile(
  dailyVix: DailyVixSeries | undefined,
  lookback: number = DEFAULT_VIX_PERCENTILE_LOOKBACK,
): VixPercentileSnapshot {
  const empty: VixPercentileSnapshot = {
    value: null,
    percentile: null,
    observations: 0,
    lookback,
    from: null,
    to: null,
  }
  if (!dailyVix || dailyVix.close.length === 0) return empty

  const closes = dailyVix.close
  const latestIndex = lastValidIndex(closes)
  if (latestIndex < 0) return empty

  const windowSize = Math.max(1, Math.floor(lookback))
  const start = Math.max(0, latestIndex - windowSize + 1)
  const observations = closes.slice(start, latestIndex + 1).filter(isFiniteNumber)
  const value = closes[latestIndex] as number

  return {
    value,
    percentile: observations.length > 0 ? percentileRank(observations, value) : null,
    observations: observations.length,
    lookback: windowSize,
    from: dailyVix.dates[start] ?? null,
    to: dailyVix.dates[latestIndex] ?? null,
  }
}

function changeOverSessions(dailyVix: DailyVixSeries, sessions: number): VixChangeSnapshot {
  const closes = dailyVix.close
  const latestIndex = lastValidIndex(closes)
  if (latestIndex < 0) return { absolute: null, percent: null }
  let referenceIndex = latestIndex - sessions
  while (referenceIndex >= 0 && !isFiniteNumber(closes[referenceIndex])) referenceIndex -= 1
  if (referenceIndex < 0) return { absolute: null, percent: null }

  const latest = closes[latestIndex] as number
  const reference = closes[referenceIndex] as number
  const absolute = latest - reference
  return {
    absolute,
    percent: reference !== 0 ? (absolute / reference) * 100 : null,
  }
}

export function getTermStructureRegime(frontRatio: number | null): TermStructureRegime | null {
  if (!isFiniteNumber(frontRatio)) return null
  if (frontRatio > 1.0) return 'backwardation'
  if (frontRatio < 0.95) return 'contango'
  return 'flat'
}

export function getLatestTermStructure(
  termStructure: TermStructureSeries | undefined,
): TermStructureSnapshot {
  const empty: TermStructureSnapshot = {
    date: null,
    vix: null,
    vix9d: null,
    vix3m: null,
    vix6m: null,
    shortRatio: null,
    frontRatio: null,
    slopePct: null,
    regime: null,
  }
  if (!termStructure) return empty

  let index = -1
  for (let candidate = termStructure.dates.length - 1; candidate >= 0; candidate -= 1) {
    if (
      isFiniteNumber(termStructure.vix[candidate]) ||
      isFiniteNumber(termStructure.vix3m[candidate]) ||
      isFiniteNumber(termStructure.vix6m[candidate])
    ) {
      index = candidate
      break
    }
  }
  if (index < 0) return empty

  const vix = termStructure.vix[index]
  const vix9d = termStructure.vix9d[index]
  const vix3m = termStructure.vix3m[index]
  const vix6m = termStructure.vix6m[index]
  const frontRatio = safeRatio(vix, vix3m)
  return {
    date: termStructure.dates[index] ?? null,
    vix: isFiniteNumber(vix) ? vix : null,
    vix9d: isFiniteNumber(vix9d) ? vix9d : null,
    vix3m: isFiniteNumber(vix3m) ? vix3m : null,
    vix6m: isFiniteNumber(vix6m) ? vix6m : null,
    shortRatio: safeRatio(vix9d, vix),
    frontRatio,
    slopePct: frontRatio === null ? null : (1 / frontRatio - 1) * 100,
    regime: getTermStructureRegime(frontRatio),
  }
}

function realizedVolatility(closes: Array<number | null | undefined>, window = 20): number | null {
  const latestIndex = lastValidIndex(closes)
  if (latestIndex <= 0) return null
  const values: number[] = []
  for (let index = latestIndex; index >= 0 && values.length < window + 1; index -= 1) {
    const value = closes[index]
    if (!isFiniteNumber(value) || value <= 0) break
    values.push(value)
  }
  if (values.length < 10) return null
  values.reverse()
  const returns: number[] = []
  for (let index = 1; index < values.length; index += 1) {
    returns.push(Math.log(values[index] / values[index - 1]))
  }
  if (returns.length < 2) return null
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100
}

export function getBenchmarkSnapshot(dataset: Dataset): BenchmarkSnapshot | null {
  const benchmark = dataset.benchmark
  if (!benchmark) return null
  const closes = benchmark.close
  const latestIndex = lastValidIndex(closes)
  if (latestIndex < 0) {
    return {
      ticker: benchmark.ticker,
      name: benchmark.name,
      lastClose: null,
      lastDate: null,
      change1dPct: null,
      change5dPct: null,
      realizedVol20dPct: null,
    }
  }

  const latest = closes[latestIndex] as number
  let previousIndex = latestIndex - 1
  while (previousIndex >= 0 && !isFiniteNumber(closes[previousIndex])) previousIndex -= 1
  let fiveDayIndex = latestIndex - 5
  while (fiveDayIndex >= 0 && !isFiniteNumber(closes[fiveDayIndex])) fiveDayIndex -= 1
  const previous = previousIndex >= 0 ? (closes[previousIndex] as number) : null
  const fiveDay = fiveDayIndex >= 0 ? (closes[fiveDayIndex] as number) : null

  return {
    ticker: benchmark.ticker,
    name: benchmark.name,
    lastClose: latest,
    lastDate: benchmark.dates[latestIndex] ?? null,
    change1dPct: previous ? (latest / previous - 1) * 100 : null,
    change5dPct: fiveDay ? (latest / fiveDay - 1) * 100 : null,
    realizedVol20dPct: realizedVolatility(closes),
  }
}

export function getMarketContext(dataset: Dataset): MarketContextSnapshot {
  const dailyVix = dataset.dailyVix
  const latestIndex = dailyVix ? lastValidIndex(dailyVix.close) : -1
  const latestVix = latestIndex >= 0 ? (dailyVix!.close[latestIndex] as number) : null
  const latestDate = latestIndex >= 0 ? (dailyVix!.dates[latestIndex] ?? null) : null
  const termStructure = getLatestTermStructure(dataset.termStructure)

  return {
    asOf: termStructure.date ?? latestDate ?? dataset.vixMetrics?.currentDate ?? null,
    vix: latestVix ?? dataset.vixMetrics?.currentVix ?? null,
    vixRegime: getVixRegime(latestVix ?? dataset.vixMetrics?.currentVix),
    change1d: dailyVix ? changeOverSessions(dailyVix, 1) : { absolute: null, percent: null },
    change5d: dailyVix ? changeOverSessions(dailyVix, 5) : { absolute: null, percent: null },
    percentile: getVixPercentile(dailyVix),
    termStructure,
    benchmark: getBenchmarkSnapshot(dataset),
  }
}

export function termStructureRegimeLabel(regime: TermStructureRegime | null): string {
  switch (regime) {
    case 'backwardation':
      return 'Backwardation'
    case 'contango':
      return 'Contango'
    case 'flat':
      return 'Flat curve'
    default:
      return 'Unavailable'
  }
}

export function termStructureRegimeDescription(regime: TermStructureRegime | null): string {
  switch (regime) {
    case 'backwardation':
      return 'Near-term VIX is above 3-month VIX. Acute stress is priced now, which historically clusters near volatility peaks rather than calm markets.'
    case 'contango':
      return 'Near-term VIX is below 3-month VIX. The curve is upward sloping, the normal state when markets are calm.'
    case 'flat':
      return 'The VIX curve is close to flat. Stress is neither clearly fading nor accelerating.'
    default:
      return 'VIX term-structure data is not available in this snapshot.'
  }
}

function fxIndexAtOrBefore(fx: FxSeries, date?: string): number {
  if (!fx.dates.length) return -1
  if (!date) return fx.dates.length - 1
  for (let index = fx.dates.length - 1; index >= 0; index -= 1) {
    if (fx.dates[index] <= date) return index
  }
  return 0
}

/** USD value of one unit of `currency`, using the published FX snapshot. */
export function getFxRateToUsd(currency: string, fx: FxSeries | undefined, date?: string): number | null {
  const code = currency.trim().toUpperCase()
  if (code === 'USD') return 1
  if (!fx) return null
  const index = fxIndexAtOrBefore(fx, date)
  if (index < 0) return null
  if (code === 'EUR') return fx.EURUSD[index] ?? null
  if (code === 'GBP') return fx.GBPUSD[index] ?? null
  return null
}

export function convertCurrency(
  value: number | null | undefined,
  fromCurrency: string,
  toCurrency: string,
  fx: FxSeries | undefined,
  date?: string,
): number | null {
  if (!isFiniteNumber(value)) return null
  const from = fromCurrency.trim().toUpperCase()
  const to = toCurrency.trim().toUpperCase()
  if (from === to) return value
  const fromRate = getFxRateToUsd(from, fx, date)
  const toRate = getFxRateToUsd(to, fx, date)
  if (!isFiniteNumber(fromRate) || !isFiniteNumber(toRate) || toRate === 0) return null
  return (value * fromRate) / toRate
}

export function formatFxAvailability(currency: string, fx: FxSeries | undefined): boolean {
  return getFxRateToUsd(currency, fx) !== null
}
