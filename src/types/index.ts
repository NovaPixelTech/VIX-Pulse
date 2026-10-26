export type Peak = {
  vixPeakDate: string
  vixPeakValue: number
  assetPriceAtPeak: number
  vixRecoveryDate: string | null
  assetPriceAtRecovery: number | null
  percentChange: number | null
  daysToRecovery: number | null
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
  priceSeries: {
    dates: string[]
    vix: (number | null)[]
    price: (number | null)[]
    frequency?: 'weekly'
  }
  placeholder?: boolean
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
  assets: Asset[]
}
