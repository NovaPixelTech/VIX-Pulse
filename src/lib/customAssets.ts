import type { Asset, DailyVixSeries } from '@/types'
import {
  computePeaksForAsset,
  VIX_RESPONSE_PEAK_THRESHOLD,
  VIX_RESPONSE_RECOVERY_THRESHOLD,
} from '@/lib/vixResponse'

export type CustomAssetInput = {
  ticker: string
  name?: string
  isin?: string
  type: Asset['type']
  currency: string
  exchange: string
  priceCsv: string
}

export type CustomAssetMetadataInput = Omit<CustomAssetInput, 'priceCsv'>

export type DatedPrice = { date: string; close: number }

function parseDate(value: string): string | null {
  const trimmed = value.trim().replace(/^"|"$/g, '')
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    if (
      date.getUTCFullYear() === Number(iso[1]) &&
      date.getUTCMonth() === Number(iso[2]) - 1 &&
      date.getUTCDate() === Number(iso[3])
    ) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    }
    return null
  }

  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (usDate) {
    return parseDate(`${usDate[3]}-${usDate[1]}-${usDate[2]}`)
  }

  return null
}

function parseClose(value: string): number | null {
  let normalized = value.trim().replace(/^"|"$/g, '').replace(/\s/g, '')
  if (normalized.includes(',') && !normalized.includes('.')) normalized = normalized.replace(',', '.')
  const close = Number(normalized)
  return Number.isFinite(close) && close > 0 ? close : null
}

export function parseDailyPriceCsv(csv: string): DatedPrice[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error('Paste a daily price CSV with a date column and a close-price column.')
  }

  const delimiter = lines[0].includes('\t')
    ? '\t'
    : lines[0].includes(';') && !lines[0].includes(',')
      ? ';'
      : ','
  const split = (line: string) => line.split(delimiter).map((value) => value.trim())
  const firstRow = split(lines[0]).map((value) => value.replace(/^"|"$/g, '').toLowerCase())
  const hasHeader = firstRow.some((value) => /^(date|datetime|timestamp)$/.test(value))

  let dateIndex = 0
  let closeIndex = 1
  let startLine = 0
  if (hasHeader) {
    dateIndex = firstRow.findIndex((value) => /^(date|datetime|timestamp)$/.test(value))
    closeIndex = firstRow.findIndex((value) => /^(adj close|adjclose|adjusted close)$/.test(value))
    if (closeIndex < 0) closeIndex = firstRow.findIndex((value) => value === 'close')
    if (closeIndex < 0) {
      throw new Error('The CSV header must contain a Close or Adj Close column.')
    }
    startLine = 1
  }

  const byDate = new Map<string, number>()
  for (const line of lines.slice(startLine)) {
    const fields = split(line)
    const date = parseDate(fields[dateIndex] ?? '')
    const close = parseClose(fields[closeIndex] ?? '')
    if (date && close !== null) byDate.set(date, close)
  }

  const prices = [...byDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((left, right) => left.date.localeCompare(right.date))
  if (prices.length < 2) {
    throw new Error('Could not read at least two dated closing prices from the CSV.')
  }
  return prices
}

function pricesOnDates(prices: DatedPrice[], dates: string[]): Array<number | null> {
  let priceIndex = 0
  let latestClose: number | null = null
  return dates.map((date) => {
    while (priceIndex < prices.length && prices[priceIndex].date <= date) {
      latestClose = prices[priceIndex].close
      priceIndex++
    }
    return latestClose
  })
}

export function createCustomAssetFromPrices(
  input: CustomAssetMetadataInput,
  prices: DatedPrice[],
  dailyVix: DailyVixSeries,
  weeklyReference: Asset,
): Asset {
  const suppliedTicker = input.ticker.trim()
  const suppliedName = input.name?.trim() ?? ''
  const suppliedIsin = input.isin?.trim() ?? ''
  if (!suppliedTicker && !suppliedName && !suppliedIsin) {
    throw new Error('Enter at least one asset identifier: ticker, name, or ISIN.')
  }
  const ticker = (suppliedTicker || suppliedIsin || suppliedName.replace(/\s+/g, '-')).toUpperCase()
  if (
    dailyVix.dates.length === 0 ||
    dailyVix.high.length !== dailyVix.dates.length ||
    dailyVix.close.length !== dailyVix.dates.length
  ) {
    throw new Error('Daily VIX data is unavailable, so this asset cannot use the same event analysis yet.')
  }

  if (prices.length < 2) throw new Error('At least two daily closing prices are required.')
  const priceByDate = new Map(prices.map(({ date, close }) => [date, close]))
  const observedSessions = dailyVix.dates.filter((date) => priceByDate.has(date)).length
  if (observedSessions < 2) {
    throw new Error('The imported prices must overlap at least two sessions in the app’s VIX calendar.')
  }

  const dailyPriceSeries = pricesOnDates(prices, dailyVix.dates)
  const dailyPriceObserved = dailyVix.dates.map((date) => priceByDate.has(date))
  const weeklyPrices = pricesOnDates(prices, weeklyReference.priceSeries.dates)
  const isin = suppliedIsin.toUpperCase() || `CUSTOM-${ticker.replace(/[^A-Z0-9.-]/g, '-')}`
  const asset: Asset = {
    isin,
    ticker,
    name: suppliedName || suppliedIsin || ticker,
    type: input.type,
    currency: input.currency.trim().toUpperCase() || 'USD',
    exchange: input.exchange.trim() || 'Custom',
    peaks: [],
    summary: { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 },
    priceSeries: {
      dates: weeklyReference.priceSeries.dates,
      vix: weeklyReference.priceSeries.vix,
      price: weeklyPrices,
      frequency: 'weekly',
    },
    dailyPriceSeries,
    dailyPriceObserved,
    customPriceHistory: prices,
    placeholder: false,
  }

  asset.peaks = computePeaksForAsset(
    asset,
    VIX_RESPONSE_PEAK_THRESHOLD,
    VIX_RESPONSE_RECOVERY_THRESHOLD,
    dailyVix,
  )
  const recoveredPeaks = asset.peaks.filter((peak) => peak.percentChange !== null)
  asset.summary = recoveredPeaks.length
    ? {
        meanChange:
          recoveredPeaks.reduce((sum, peak) => sum + peak.percentChange!, 0) / recoveredPeaks.length,
        maxChange: Math.max(...recoveredPeaks.map((peak) => peak.percentChange!)),
        meanDays:
          recoveredPeaks.reduce((sum, peak) => sum + (peak.daysToRecovery ?? 0), 0) / recoveredPeaks.length,
        meanVix: recoveredPeaks.reduce((sum, peak) => sum + peak.vixPeakValue, 0) / recoveredPeaks.length,
      }
    : { meanChange: 0, maxChange: 0, meanDays: 0, meanVix: 0 }

  const latest = prices[prices.length - 1]
  const previous = prices[prices.length - 2]
  asset.latestQuote = {
    price: latest.close,
    date: latest.date,
    previousPrice: previous.close,
    previousDate: previous.date,
    changeAbs: latest.close - previous.close,
    changePct: ((latest.close - previous.close) / previous.close) * 100,
  }
  return asset
}

export function createCustomAssetFromCsv(
  input: CustomAssetInput,
  dailyVix: DailyVixSeries,
  weeklyReference: Asset,
): Asset {
  return {
    ...createCustomAssetFromPrices(input, parseDailyPriceCsv(input.priceCsv), dailyVix, weeklyReference),
    customDataSource: 'Manual CSV',
  }
}
