export type Peak = {
  vixPeakDate: string
  vixPeakValue: number
  assetPriceAtPeak: number
  vixRecoveryDate: string | null
  assetPriceAtRecovery: number | null
  percentChange: number | null
  daysToRecovery: number | null
}

export type LatestQuote = {
  price: number
  date: string
  previousPrice: number | null
  previousDate: string | null
  changeAbs: number | null
  changePct: number | null
}

export type Asset = {
  isin: string
  ticker: string
  name: string
  type: 'stock' | 'etf' | 'etc' | 'adr' | 'index'
  currency: string
  exchange: string
  peaks: Peak[]
  summary: {
    meanChange: number
    maxChange: number
    meanDays: number
    meanVix: number
  }
  latestQuote?: LatestQuote | null
  priceSeries: {
    dates: string[]
    vix: (number | null)[]
    price: (number | null)[]
    frequency?: 'weekly'
  }
  /** Daily closes aligned to Dataset.dailyVix.dates for exact event analysis. */
  dailyPriceSeries?: Array<number | null>
  /** Whether a real asset close exists on each aligned VIX trading date. */
  dailyPriceObserved?: boolean[]
  placeholder?: boolean
  /** Browser-only dated history for user-added assets. */
  customPriceHistory?: Array<{ date: string; close: number }>
  customDataSource?: 'Twelve Data' | 'Manual CSV' | 'Yahoo Finance CSV' | 'Other CSV'
}

export type DailyVixSeries = {
  dates: string[]
  high: Array<number | null>
  close: Array<number | null>
}

export type AnalysisDateRange = {
  from?: string
  to?: string
}

export type BenchmarkSeries = {
  ticker: string
  name: string
  currency: string
  dates: string[]
  close: Array<number | null>
}

export type TermStructureSeries = {
  dates: string[]
  vix: Array<number | null>
  vix9d: Array<number | null>
  vix3m: Array<number | null>
  vix6m: Array<number | null>
}

export type FxSeries = {
  dates: string[]
  EURUSD: Array<number | null>
  GBPUSD: Array<number | null>
}

export type VixMetrics = {
  currentVix: number
  currentDate: string
  previousDayVix: number
  previousDayDate: string
  changeDayAbs: number
  changeDayPct: number
  latestWeekVix: number
  latestWeekDate: string
  previousWeekVix: number
  previousWeekDate: string
  changeWeekAbs: number
  changeWeekPct: number
}

export type Dataset = {
  generatedAt: string
  vixThresholdPeak: number
  vixThresholdRecovery: number
  dateRange: { from: string; to: string }
  vixMetrics?: VixMetrics
  dailyVix?: DailyVixSeries
  benchmark?: BenchmarkSeries
  termStructure?: TermStructureSeries
  fx?: FxSeries
  contextUpdatedAt?: string
  assets: Asset[]
  customAssets?: Asset[]
}
