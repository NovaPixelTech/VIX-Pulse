import { buildReaderUrl, finiteNumber, parseYahooChartPayload, type YahooChartMeta } from './yahooCsv'

const YAHOO_VIX_CHART_TARGET = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=5m'

/** How often the live banner polls for a fresh quote while the tab is visible. */
export const REALTIME_VIX_POLL_MS = 60_000

export type VixMarketState = 'regular' | 'pre' | 'post' | 'closed'

export type RealtimeVixPoint = {
  timeMs: number
  close: number
}

export type RealtimeVixQuote = {
  price: number
  previousClose: number
  changeAbs: number
  changePct: number
  quoteTimeMs: number | null
  marketState: VixMarketState
  exchangeTimeZone: string | null
  dayHigh: number | null
  dayLow: number | null
  fetchedAtMs: number
  intraday: RealtimeVixPoint[]
}

type TradingPeriod = {
  start?: number
  end?: number
}

type LiveChartMeta = YahooChartMeta & {
  regularMarketPrice?: number
  previousClose?: number
  chartPreviousClose?: number
  regularMarketTime?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  hasPrePostMarketData?: boolean
  currentTradingPeriod?: {
    pre?: TradingPeriod
    regular?: TradingPeriod
    post?: TradingPeriod
  }
}

/** A live quote can lag the exchange, so freshness tolerates delayed index feeds. */
const FRESH_QUOTE_TOLERANCE_SEC = 30 * 60

/**
 * Yahoo reports the exchange's current trading window rather than a market flag.
 * Some index feeds also publish an unreliable early session start and a delayed
 * quote time, so an open session additionally requires a recently updating quote;
 * the session end is trusted because it matches the exchange close.
 */
export function deriveMarketState(
  meta: LiveChartMeta,
  quoteTimeSec: number | null,
  nowMs: number = Date.now(),
): VixMarketState {
  const nowSec = Math.floor(nowMs / 1000)
  const regular = meta.currentTradingPeriod?.regular
  const start = typeof regular?.start === 'number' ? regular.start : null
  const end = typeof regular?.end === 'number' ? regular.end : null
  const hasExtendedHours = meta.hasPrePostMarketData === true

  if (end !== null && nowSec > end) return hasExtendedHours ? 'post' : 'closed'
  if (start !== null && nowSec < start) return hasExtendedHours ? 'pre' : 'closed'

  // The quote can lag the exchange and clock skew can push it slightly ahead.
  if (quoteTimeSec !== null) {
    const ageSec = nowSec - quoteTimeSec
    return ageSec <= FRESH_QUOTE_TOLERANCE_SEC && ageSec >= -600 ? 'regular' : 'closed'
  }
  return start !== null && end !== null ? 'regular' : 'closed'
}

export function buildVixLiveReaderUrl(): string {
  return buildReaderUrl(YAHOO_VIX_CHART_TARGET)
}

export function parseRealtimeVixQuote(text: string, fetchedAtMs: number = Date.now()): RealtimeVixQuote {
  const payload = parseYahooChartPayload(text)
  const result = payload.chart?.result?.[0]
  const meta = (result?.meta ?? {}) as LiveChartMeta
  const price = finiteNumber(meta.regularMarketPrice)
  if (price === null || price <= 0) {
    throw new Error('Yahoo returned no live VIX price.')
  }

  const previousClose = finiteNumber(meta.chartPreviousClose) ?? finiteNumber(meta.previousClose) ?? price
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const intraday: RealtimeVixPoint[] = []
  timestamps.forEach((timestamp, index) => {
    const close = finiteNumber(closes[index])
    if (close !== null && close > 0) {
      intraday.push({ timeMs: timestamp * 1000, close })
    }
  })

  const changeAbs = price - previousClose
  const changePct = previousClose !== 0 ? (changeAbs / previousClose) * 100 : 0
  const quoteTimeSec = finiteNumber(meta.regularMarketTime)
  const timeZone = meta.exchangeTimezoneName?.trim()

  return {
    price,
    previousClose,
    changeAbs: Number(changeAbs.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    quoteTimeMs: quoteTimeSec !== null ? quoteTimeSec * 1000 : null,
    marketState: deriveMarketState(meta, quoteTimeSec, fetchedAtMs),
    exchangeTimeZone: timeZone || null,
    dayHigh: finiteNumber(meta.regularMarketDayHigh),
    dayLow: finiteNumber(meta.regularMarketDayLow),
    fetchedAtMs,
    intraday,
  }
}

export async function fetchRealtimeVix(): Promise<RealtimeVixQuote> {
  let response: Response
  try {
    response = await fetch(buildVixLiveReaderUrl(), { cache: 'no-store' })
  } catch {
    throw new Error('Could not reach the live VIX relay.')
  }
  if (!response.ok) {
    throw new Error(`The live VIX request failed (${response.status}).`)
  }
  return parseRealtimeVixQuote(await response.text())
}
