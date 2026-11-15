import type { Asset, Dataset } from '@/types'
import { convertCurrency } from '@/lib/marketContext'

export type EdgeBaseCurrency = 'USD' | 'EUR' | 'GBP'

export type TradeExitReason = 'vix-recovery' | 'stop-loss' | 'max-holding' | 'end-of-data'

export interface ExecutableEdgeOptions {
  /** First VIX close strictly above this level is the entry signal. */
  peakThreshold: number
  /** Exit when VIX closes strictly below this level. */
  recoveryThreshold: number
  /** Close-based stop loss from the entry price. Set to 0 to disable. */
  stopLossPct: number
  /** Maximum holding period in trading sessions. Set to 0 to disable. */
  maxHoldingDays: number
  /** One-way cost in basis points, charged on entry and again on exit. */
  costBps: number
  baseCurrency: EdgeBaseCurrency
  from?: string
  to?: string
  /** Number of bootstrap resamples for the confidence interval. */
  bootstrapSamples?: number
}

export const DEFAULT_EDGE_OPTIONS: ExecutableEdgeOptions = {
  peakThreshold: 21,
  recoveryThreshold: 20,
  stopLossPct: 10,
  maxHoldingDays: 60,
  costBps: 10,
  baseCurrency: 'USD',
  bootstrapSamples: 2_000,
}

export interface ExecutableTrade {
  ticker: string
  currency: string
  baseCurrency: EdgeBaseCurrency
  signalDate: string
  signalVix: number
  entryDate: string
  entryVix: number
  entryPriceLocal: number
  entryPriceBase: number
  exitDate: string
  exitVix: number | null
  exitPriceLocal: number
  exitPriceBase: number
  holdingBars: number
  holdingCalendarDays: number
  grossReturnPct: number
  netReturnPct: number
  benchmarkEntry: number
  benchmarkExit: number
  benchmarkNetReturnPct: number
  excessReturnPct: number
  /** Maximum adverse excursion measured on close prices after entry. */
  maePct: number | null
  /** Maximum favourable excursion measured on close prices after entry. */
  mfePct: number | null
  exitReason: TradeExitReason
}

export interface ExecutableEdgeResult {
  isin: string
  ticker: string
  name: string
  currency: string
  baseCurrency: EdgeBaseCurrency
  benchmarkTicker: string
  trades: ExecutableTrade[]
  sampleSize: number
  minTradesForRanking: number
  winRatePct: number | null
  absoluteWinRatePct: number | null
  meanNetReturnPct: number | null
  medianNetReturnPct: number | null
  meanExcessReturnPct: number | null
  medianExcessReturnPct: number | null
  excessStdevPct: number | null
  tStat: number | null
  ci95Low: number | null
  ci95High: number | null
  profitFactor: number | null
  meanMaePct: number | null
  meanMfePct: number | null
  worstNetReturnPct: number | null
  bestNetReturnPct: number | null
  meanHoldingBars: number | null
  exposurePct: number | null
  compoundedNetReturnPct: number | null
  compoundedBenchmarkReturnPct: number | null
  compoundedExcessPct: number | null
  firstSignalDate: string | null
  lastExitDate: string | null
  benchmarkAvailable: boolean
  fxAvailable: boolean
}

interface PreparedAsset {
  asset: Asset
  dates: string[]
  vixClose: Array<number | null>
  prices: Array<number | null>
  observed: boolean[]
  benchmark: number[]
  benchmarkAvailable: boolean
  fxAvailable: boolean
  fromIndex: number
  toIndex: number
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function lastIndexAtOrBefore(dates: string[], target?: string): number {
  if (!target) return dates.length - 1
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    if (dates[index] <= target) return index
  }
  return -1
}

function firstIndexAtOrAfter(dates: string[], target?: string): number {
  if (!target) return 0
  const index = dates.findIndex((date) => date >= target)
  return index < 0 ? -1 : index
}

function daysBetween(start: string, end: string): number {
  return Math.max(
    0,
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000),
  )
}

function benchmarkPriceAt(dataset: Dataset, date: string): number | null {
  const benchmark = dataset.benchmark
  if (!benchmark) return null
  // The published context is aligned to the VIX calendar, so the common case
  // is an exact date match. Fall back to the last available close otherwise.
  const index = benchmark.dates.indexOf(date)
  if (index >= 0) {
    const value = benchmark.close[index]
    return isFiniteNumber(value) ? value : null
  }
  const fallback = lastIndexAtOrBefore(benchmark.dates, date)
  if (fallback < 0) return null
  const value = benchmark.close[fallback]
  return isFiniteNumber(value) ? value : null
}

function prepareAsset(dataset: Dataset, asset: Asset, options: ExecutableEdgeOptions): PreparedAsset | null {
  const dailyVix = dataset.dailyVix
  if (!dailyVix || dailyVix.close.length === 0) return null
  if (asset.dailyPriceSeries?.length !== dailyVix.dates.length) return null

  const dates = dailyVix.dates
  const fromIndex = firstIndexAtOrAfter(dates, options.from)
  const toIndex = lastIndexAtOrBefore(dates, options.to)
  if (fromIndex < 0 || toIndex < fromIndex) return null

  const observed = dailyVix.dates.map((_, index) => {
    const price = asset.dailyPriceSeries?.[index]
    if (!isFiniteNumber(price)) return false
    return asset.dailyPriceObserved?.[index] ?? true
  })
  const benchmarkAvailable = Boolean(dataset.benchmark)
  const benchmark = dates.map((date) => benchmarkPriceAt(dataset, date) ?? Number.NaN)
  const fxAvailable = ['USD', 'EUR', 'GBP'].includes(asset.currency.trim().toUpperCase())

  return {
    asset,
    dates,
    vixClose: dailyVix.close,
    prices: asset.dailyPriceSeries ?? [],
    observed,
    benchmark,
    benchmarkAvailable,
    fxAvailable,
    fromIndex,
    toIndex,
  }
}

function priceInBase(
  value: number,
  assetCurrency: string,
  options: ExecutableEdgeOptions,
  dataset: Dataset,
  date: string,
): number | null {
  return convertCurrency(value, assetCurrency, options.baseCurrency, dataset.fx, date)
}

function benchmarkInBase(dataset: Dataset, options: ExecutableEdgeOptions, date: string): number | null {
  const price = benchmarkPriceAt(dataset, date)
  if (!isFiniteNumber(price)) return null
  const currency = dataset.benchmark?.currency ?? 'USD'
  return convertCurrency(price, currency, options.baseCurrency, dataset.fx, date)
}

function findNextEntry(
  prepared: PreparedAsset,
  startIndex: number,
  dataset: Dataset,
  options: ExecutableEdgeOptions,
): number {
  for (let index = startIndex; index <= prepared.toIndex; index += 1) {
    if (!prepared.observed[index]) continue
    const price = prepared.prices[index]
    if (!isFiniteNumber(price) || price <= 0) continue
    if (
      !isFiniteNumber(priceInBase(price, prepared.asset.currency, options, dataset, prepared.dates[index]))
    ) {
      continue
    }
    if (!isFiniteNumber(benchmarkInBase(dataset, options, prepared.dates[index]))) continue
    return index
  }
  return -1
}

function findExitAfterRecovery(
  prepared: PreparedAsset,
  afterIndex: number,
  dataset: Dataset,
  options: ExecutableEdgeOptions,
): number {
  for (let index = afterIndex + 1; index <= prepared.toIndex; index += 1) {
    if (!prepared.observed[index]) continue
    const price = prepared.prices[index]
    if (!isFiniteNumber(price) || price <= 0) continue
    if (
      !isFiniteNumber(priceInBase(price, prepared.asset.currency, options, dataset, prepared.dates[index]))
    ) {
      continue
    }
    return index
  }
  return -1
}

function lastUsableExit(
  prepared: PreparedAsset,
  fromIndex: number,
  dataset: Dataset,
  options: ExecutableEdgeOptions,
): number {
  for (let index = Math.min(prepared.toIndex, prepared.dates.length - 1); index >= fromIndex; index -= 1) {
    if (!prepared.observed[index]) continue
    const price = prepared.prices[index]
    if (!isFiniteNumber(price) || price <= 0) continue
    if (
      !isFiniteNumber(priceInBase(price, prepared.asset.currency, options, dataset, prepared.dates[index]))
    ) {
      continue
    }
    return index
  }
  return -1
}

function buildTrade(
  prepared: PreparedAsset,
  dataset: Dataset,
  options: ExecutableEdgeOptions,
  signalIndex: number,
  entryIndex: number,
): { trade: ExecutableTrade; exitIndex: number } | null {
  const { asset, dates, vixClose, prices } = prepared
  const signalVix = vixClose[signalIndex]
  const entryPriceLocal = prices[entryIndex]
  if (!isFiniteNumber(signalVix) || !isFiniteNumber(entryPriceLocal) || entryPriceLocal <= 0) return null

  const entryPriceBase = priceInBase(entryPriceLocal, asset.currency, options, dataset, dates[entryIndex])
  const benchmarkEntry = benchmarkInBase(dataset, options, dates[entryIndex])
  if (!isFiniteNumber(entryPriceBase) || !isFiniteNumber(benchmarkEntry) || benchmarkEntry <= 0) return null

  const stopLossPct = Math.max(0, options.stopLossPct)
  const maxHoldingBars = Math.max(0, Math.floor(options.maxHoldingDays))
  const stopPrice = stopLossPct > 0 ? entryPriceBase * (1 - stopLossPct / 100) : null

  let exitIndex = -1
  let exitReason: TradeExitReason = 'end-of-data'
  let maePct: number | null = null
  let mfePct: number | null = null

  for (let index = entryIndex + 1; index <= prepared.toIndex; index += 1) {
    if (!prepared.observed[index]) continue
    const localPrice = prices[index]
    if (!isFiniteNumber(localPrice) || localPrice <= 0) continue
    const basePrice = priceInBase(localPrice, asset.currency, options, dataset, dates[index])
    if (!isFiniteNumber(basePrice)) continue

    const movePct = (basePrice / entryPriceBase - 1) * 100
    maePct = maePct === null ? movePct : Math.min(maePct, movePct)
    mfePct = mfePct === null ? movePct : Math.max(mfePct, movePct)

    if (stopPrice !== null && basePrice <= stopPrice) {
      exitIndex = index
      exitReason = 'stop-loss'
      break
    }

    const currentVix = vixClose[index]
    if (isFiniteNumber(currentVix) && currentVix < options.recoveryThreshold) {
      const recoveryExit = findExitAfterRecovery(prepared, index, dataset, options)
      if (recoveryExit >= 0) {
        exitIndex = recoveryExit
        exitReason = 'vix-recovery'
        const recoveryLocal = prices[recoveryExit]
        if (isFiniteNumber(recoveryLocal)) {
          const recoveryBase = priceInBase(
            recoveryLocal,
            asset.currency,
            options,
            dataset,
            dates[recoveryExit],
          )
          if (isFiniteNumber(recoveryBase)) {
            const finalMove = (recoveryBase / entryPriceBase - 1) * 100
            maePct = maePct === null ? finalMove : Math.min(maePct, finalMove)
            mfePct = mfePct === null ? finalMove : Math.max(mfePct, finalMove)
          }
        }
      } else {
        const fallback = lastUsableExit(prepared, index, dataset, options)
        exitIndex = fallback >= 0 ? fallback : index
        exitReason = 'end-of-data'
      }
      break
    }

    if (maxHoldingBars > 0 && index - entryIndex >= maxHoldingBars) {
      exitIndex = index
      exitReason = 'max-holding'
      break
    }
  }

  if (exitIndex < 0) {
    const fallback = lastUsableExit(prepared, entryIndex, dataset, options)
    if (fallback < 0 || fallback <= entryIndex) return null
    exitIndex = fallback
    exitReason = 'end-of-data'
  }

  const exitPriceLocal = prices[exitIndex]
  if (!isFiniteNumber(exitPriceLocal) || exitPriceLocal <= 0) return null
  const exitPriceBase = priceInBase(exitPriceLocal, asset.currency, options, dataset, dates[exitIndex])
  const benchmarkExit = benchmarkInBase(dataset, options, dates[exitIndex])
  if (!isFiniteNumber(exitPriceBase) || !isFiniteNumber(benchmarkExit) || benchmarkExit <= 0) return null

  const costFraction = Math.max(0, options.costBps) / 10_000
  const grossReturnPct = (exitPriceBase / entryPriceBase - 1) * 100
  const netFactor = (1 + grossReturnPct / 100) * (1 - costFraction) ** 2
  const netReturnPct = (netFactor - 1) * 100
  const benchmarkGrossPct = (benchmarkExit / benchmarkEntry - 1) * 100
  const benchmarkNetPct = ((1 + benchmarkGrossPct / 100) * (1 - costFraction) ** 2 - 1) * 100

  const finalMovePct = grossReturnPct
  maePct = maePct === null ? finalMovePct : Math.min(maePct, finalMovePct)
  mfePct = mfePct === null ? finalMovePct : Math.max(mfePct, finalMovePct)

  return {
    exitIndex,
    trade: {
      ticker: asset.ticker,
      currency: asset.currency,
      baseCurrency: options.baseCurrency,
      signalDate: dates[signalIndex],
      signalVix,
      entryDate: dates[entryIndex],
      entryVix: vixClose[entryIndex] ?? signalVix,
      entryPriceLocal,
      entryPriceBase,
      exitDate: dates[exitIndex],
      exitVix: isFiniteNumber(vixClose[exitIndex]) ? (vixClose[exitIndex] as number) : null,
      exitPriceLocal,
      exitPriceBase,
      holdingBars: exitIndex - entryIndex,
      holdingCalendarDays: daysBetween(dates[entryIndex], dates[exitIndex]),
      grossReturnPct,
      netReturnPct,
      benchmarkEntry,
      benchmarkExit,
      benchmarkNetReturnPct: benchmarkNetPct,
      excessReturnPct: netReturnPct - benchmarkNetPct,
      maePct,
      mfePct,
      exitReason,
    },
  }
}

export function buildExecutableTrades(
  dataset: Dataset,
  asset: Asset,
  options: ExecutableEdgeOptions = DEFAULT_EDGE_OPTIONS,
): ExecutableTrade[] {
  const prepared = prepareAsset(dataset, asset, options)
  if (!prepared) return []

  const trades: ExecutableTrade[] = []
  let cursor = Math.max(1, prepared.fromIndex)
  while (cursor <= prepared.toIndex - 1) {
    const previousVix = prepared.vixClose[cursor - 1]
    const currentVix = prepared.vixClose[cursor]
    const crossedAbove =
      isFiniteNumber(previousVix) &&
      isFiniteNumber(currentVix) &&
      currentVix > options.peakThreshold &&
      previousVix <= options.peakThreshold

    if (!crossedAbove) {
      cursor += 1
      continue
    }

    const entryIndex = findNextEntry(prepared, cursor + 1, dataset, options)
    if (entryIndex < 0) break

    const built = buildTrade(prepared, dataset, options, cursor, entryIndex)
    if (!built) {
      cursor += 1
      continue
    }

    trades.push(built.trade)
    // Trades must not overlap, so resume the signal scan after the exit.
    cursor = built.exitIndex + 1
  }

  return trades
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null
  const average = mean(values) as number
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function percentile(sorted: number[], probability: number): number | null {
  if (sorted.length === 0) return null
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function bootstrapMeanCi(
  values: number[],
  samples: number,
  seed: string,
): { low: number | null; high: number | null } {
  if (values.length < 2) return { low: null, high: null }
  const count = Math.max(200, Math.floor(samples))
  const random = mulberry32(hashString(seed))
  const means: number[] = []
  for (let sample = 0; sample < count; sample += 1) {
    let total = 0
    for (let draw = 0; draw < values.length; draw += 1) {
      total += values[Math.floor(random() * values.length)]
    }
    means.push(total / values.length)
  }
  means.sort((left, right) => left - right)
  return { low: percentile(means, 0.025), high: percentile(means, 0.975) }
}

export function summarizeExecutableEdge(
  dataset: Dataset,
  asset: Asset,
  options: ExecutableEdgeOptions = DEFAULT_EDGE_OPTIONS,
): ExecutableEdgeResult {
  const prepared = prepareAsset(dataset, asset, options)
  const trades = buildExecutableTrades(dataset, asset, options)
  const excess = trades.map((trade) => trade.excessReturnPct)
  const net = trades.map((trade) => trade.netReturnPct)
  const maes = trades.flatMap((trade) => (trade.maePct === null ? [] : [trade.maePct]))
  const mfes = trades.flatMap((trade) => (trade.mfePct === null ? [] : [trade.mfePct]))
  const holding = trades.map((trade) => trade.holdingBars)
  const averageExcess = mean(excess)
  const deviation = stdev(excess)
  const ci = bootstrapMeanCi(
    excess,
    options.bootstrapSamples ?? DEFAULT_EDGE_OPTIONS.bootstrapSamples ?? 2_000,
    `${asset.isin}|${trades.length}|${options.peakThreshold}|${options.stopLossPct}|${options.baseCurrency}`,
  )
  const positiveExcess = excess.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)
  const negativeExcess = Math.abs(excess.filter((value) => value < 0).reduce((sum, value) => sum + value, 0))
  const compoundedNet =
    trades.length > 0
      ? (trades.reduce((factor, trade) => factor * (1 + trade.netReturnPct / 100), 1) - 1) * 100
      : null
  const compoundedBenchmark =
    trades.length > 0
      ? (trades.reduce((factor, trade) => factor * (1 + trade.benchmarkNetReturnPct / 100), 1) - 1) * 100
      : null
  const windowBars = prepared ? Math.max(1, prepared.toIndex - prepared.fromIndex + 1) : null

  return {
    isin: asset.isin,
    ticker: asset.ticker,
    name: asset.name,
    currency: asset.currency,
    baseCurrency: options.baseCurrency,
    benchmarkTicker: dataset.benchmark?.ticker ?? '—',
    trades,
    sampleSize: trades.length,
    minTradesForRanking: 3,
    winRatePct: trades.length > 0 ? (excess.filter((value) => value > 0).length / trades.length) * 100 : null,
    absoluteWinRatePct:
      trades.length > 0 ? (net.filter((value) => value > 0).length / trades.length) * 100 : null,
    meanNetReturnPct: mean(net),
    medianNetReturnPct: median(net),
    meanExcessReturnPct: averageExcess,
    medianExcessReturnPct: median(excess),
    excessStdevPct: deviation,
    tStat:
      averageExcess !== null && deviation !== null && trades.length > 1 && deviation > 0
        ? averageExcess / (deviation / Math.sqrt(trades.length))
        : null,
    ci95Low: ci.low,
    ci95High: ci.high,
    profitFactor: negativeExcess > 0 ? positiveExcess / negativeExcess : null,
    meanMaePct: mean(maes),
    meanMfePct: mean(mfes),
    worstNetReturnPct: net.length > 0 ? Math.min(...net) : null,
    bestNetReturnPct: net.length > 0 ? Math.max(...net) : null,
    meanHoldingBars: mean(holding),
    exposurePct:
      windowBars && windowBars > 0
        ? (holding.reduce((sum, value) => sum + value, 0) / windowBars) * 100
        : null,
    compoundedNetReturnPct: compoundedNet,
    compoundedBenchmarkReturnPct: compoundedBenchmark,
    compoundedExcessPct:
      compoundedNet !== null && compoundedBenchmark !== null ? compoundedNet - compoundedBenchmark : null,
    firstSignalDate: trades[0]?.signalDate ?? null,
    lastExitDate: trades[trades.length - 1]?.exitDate ?? null,
    benchmarkAvailable: Boolean(prepared?.benchmarkAvailable),
    fxAvailable: Boolean(prepared?.fxAvailable),
  }
}

export function rankExecutableEdges(
  dataset: Dataset,
  options: ExecutableEdgeOptions = DEFAULT_EDGE_OPTIONS,
): ExecutableEdgeResult[] {
  return dataset.assets
    .map((asset) => summarizeExecutableEdge(dataset, asset, options))
    .sort((left, right) => {
      const leftRank =
        left.sampleSize >= left.minTradesForRanking
          ? (left.ci95Low ?? left.meanExcessReturnPct ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY
      const rightRank =
        right.sampleSize >= right.minTradesForRanking
          ? (right.ci95Low ?? right.meanExcessReturnPct ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY
      return (
        rightRank - leftRank || right.sampleSize - left.sampleSize || left.ticker.localeCompare(right.ticker)
      )
    })
}

export function countDatasetTrades(
  dataset: Dataset,
  options: ExecutableEdgeOptions = DEFAULT_EDGE_OPTIONS,
): number {
  return dataset.assets.reduce(
    (count, asset) => count + buildExecutableTrades(dataset, asset, options).length,
    0,
  )
}
