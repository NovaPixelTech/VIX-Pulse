const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_READER_PROXY = 'https://r.jina.ai/http://'
const YAHOO_SYMBOL_PATTERN = /^[A-Za-z0-9.^=_-]{1,40}$/

type YahooChartMeta = {
  currency?: string
  symbol?: string
  exchangeName?: string
  fullExchangeName?: string
  longName?: string
  shortName?: string
  gmtoffset?: number
  exchangeTimezoneName?: string
  instrumentType?: string
}

type YahooChartQuote = {
  open?: Array<number | null>
  high?: Array<number | null>
  low?: Array<number | null>
  close?: Array<number | null>
  volume?: Array<number | null>
}

type YahooChartResult = {
  meta?: YahooChartMeta
  timestamp?: number[]
  indicators?: {
    quote?: YahooChartQuote[]
    adjclose?: Array<{ adjclose?: Array<number | null> }>
  }
}

type YahooChartPayload = {
  chart?: {
    result?: YahooChartResult[]
    error?: { code?: string; description?: string } | null
  }
}

export type YahooCsvResult = {
  csv: string
  filename: string
  symbol: string
  name: string
  currency: string
  exchange: string
  instrumentType: string
  firstDate: string
  lastDate: string
  rowCount: number
}

function normalizeDate(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use the YYYY-MM-DD format.`)
  }
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`)
  }
  return parsed
}

export function normalizeYahooSymbol(symbol: string): string {
  const value = symbol.trim()
  if (!YAHOO_SYMBOL_PATTERN.test(value)) {
    throw new Error('Enter a valid Yahoo Finance symbol, such as AAPL or RHM.DE.')
  }
  return value
}

export function buildYahooChartReaderUrl(symbol: string, startDate: string, endDate: string): string {
  const cleanSymbol = normalizeYahooSymbol(symbol)
  const start = Math.floor(normalizeDate(startDate, 'Start date') / 1000)
  const end = Math.floor((normalizeDate(endDate, 'End date') + 24 * 60 * 60 * 1000 - 1) / 1000)
  if (end < start) {
    throw new Error('The end date must be on or after the start date.')
  }

  const target = `${YAHOO_CHART_BASE}/${encodeURIComponent(cleanSymbol)}?period1=${start}&period2=${end}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`
  return `${YAHOO_READER_PROXY}${target.slice('https://'.length).replace(/%/g, '%25').replace(/&/g, '%26')}`
}

function parseYahooChartPayload(text: string): YahooChartPayload {
  const marker = text.indexOf('Markdown Content:')
  const jsonStart = text.indexOf('{', marker >= 0 ? marker + 'Markdown Content:'.length : 0)
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error(
      'Yahoo returned an unreadable response. Check the symbol and dates, or upload a Yahoo CSV manually.',
    )
  }

  let parsed: YahooChartPayload
  try {
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as YahooChartPayload
  } catch {
    throw new Error(
      'Yahoo returned an unreadable response. Check the symbol and dates, or upload a Yahoo CSV manually.',
    )
  }

  const error = parsed.chart?.error
  if (error) {
    throw new Error(
      error.description ||
        'Yahoo could not return history for that symbol and date range. Check the Yahoo symbol and try again.',
    )
  }
  return parsed
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function csvNumber(value: number | null | undefined, divisor = 1): string {
  const number = finiteNumber(value)
  return number === null ? '' : String(number / divisor)
}

function makeYahooDateFormatter(meta: YahooChartMeta): (timestamp: number) => string {
  const timeZone = meta.exchangeTimezoneName?.trim()
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return (timestamp) => {
        const parts = formatter.formatToParts(new Date(timestamp * 1000))
        const year = parts.find((part) => part.type === 'year')?.value
        const month = parts.find((part) => part.type === 'month')?.value
        const day = parts.find((part) => part.type === 'day')?.value
        if (year && month && day) return `${year}-${month}-${day}`
        return new Date(timestamp * 1000).toISOString().slice(0, 10)
      }
    } catch {
      // Fall back to the exchange offset below for unsupported time-zone data.
    }
  }

  const offset = finiteNumber(meta.gmtoffset) ?? 0
  return (timestamp) => new Date((timestamp + offset) * 1000).toISOString().slice(0, 10)
}

export function buildYahooCsv(text: string, fallbackSymbol: string): YahooCsvResult {
  const parsed = parseYahooChartPayload(text)
  const result = parsed.chart?.result?.[0]
  const timestamps = result?.timestamp
  if (!result || !Array.isArray(timestamps) || timestamps.length === 0) {
    throw new Error('Yahoo returned no daily history for that symbol and date range.')
  }

  const meta = result.meta ?? {}
  const quote = result.indicators?.quote?.[0]
  const adjustedClose = result.indicators?.adjclose?.[0]?.adjclose
  const formatDate = makeYahooDateFormatter(meta)
  const rawCurrency = meta.currency?.trim() || 'USD'
  const priceDivisor = rawCurrency === 'GBp' || rawCurrency === 'GBX' ? 100 : 1
  const displayCurrency = priceDivisor === 100 ? 'GBP' : rawCurrency.toUpperCase()
  const rows = new Map<string, string[]>()

  timestamps.forEach((timestamp, index) => {
    const close = finiteNumber(quote?.close?.[index])
    const adjusted = finiteNumber(adjustedClose?.[index])
    const price = adjusted ?? close
    if (price === null || price <= 0) return

    const date = formatDate(timestamp)
    rows.set(date, [
      date,
      csvNumber(quote?.open?.[index], priceDivisor),
      csvNumber(quote?.high?.[index], priceDivisor),
      csvNumber(quote?.low?.[index], priceDivisor),
      csvNumber(close ?? price, priceDivisor),
      csvNumber(adjusted ?? close ?? price, priceDivisor),
      csvNumber(quote?.volume?.[index]),
    ])
  })

  const sortedRows = [...rows.values()].sort((left, right) => left[0].localeCompare(right[0]))
  if (sortedRows.length < 2) {
    throw new Error('Yahoo returned fewer than two usable daily prices for that symbol and date range.')
  }

  const symbol = meta.symbol?.trim() || normalizeYahooSymbol(fallbackSymbol)
  const fileSymbol = symbol.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'Yahoo'
  const firstDate = sortedRows[0][0]
  const lastDate = sortedRows[sortedRows.length - 1][0]
  const csv = ['Date,Open,High,Low,Close,Adj Close,Volume', ...sortedRows.map((row) => row.join(','))].join(
    '\n',
  )

  return {
    csv: `${csv}\n`,
    filename: `${fileSymbol}_${firstDate}_${lastDate}.csv`,
    symbol,
    name: meta.longName?.trim() || meta.shortName?.trim() || symbol,
    currency: displayCurrency,
    exchange: meta.fullExchangeName?.trim() || meta.exchangeName?.trim() || 'Yahoo Finance',
    instrumentType: meta.instrumentType?.trim().toUpperCase() || '',
    firstDate,
    lastDate,
    rowCount: sortedRows.length,
  }
}

export async function fetchYahooDailyCsv(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<YahooCsvResult> {
  const url = buildYahooChartReaderUrl(symbol, startDate, endDate)
  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store' })
  } catch {
    throw new Error(
      'Could not reach the Yahoo CSV relay. Check your connection or upload a Yahoo CSV manually.',
    )
  }
  if (!response.ok) {
    throw new Error(
      `The Yahoo CSV download failed (${response.status}). Try again or upload a Yahoo CSV manually.`,
    )
  }
  return buildYahooCsv(await response.text(), symbol)
}
