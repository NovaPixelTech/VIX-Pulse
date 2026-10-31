export type TwelveDataInstrument = {
  symbol: string
  instrument_name: string
  exchange: string
  mic_code?: string
  country?: string
  isin?: string
  currency: string
  instrument_type: string
}

export type TwelveDataDailyPrice = { date: string; close: number }

export type TwelveDataSeries = {
  instrument: TwelveDataInstrument
  prices: TwelveDataDailyPrice[]
}

const API_KEY_STORAGE_KEY = 'vix-pulse-twelvedata-api-key'
const API_BASE_URL = 'https://api.twelvedata.com'

export function getTwelveDataApiKey(): string {
  try {
    return typeof window === 'undefined' ? '' : (window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
  } catch {
    return ''
  }
}

export function saveTwelveDataApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = apiKey.trim()
    if (trimmed) window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch {
    throw new Error('This browser could not save the API key to local storage.')
  }
}

async function requestJson<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(path, API_BASE_URL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `apikey ${apiKey}` },
    })
  } catch {
    throw new Error('Could not reach Twelve Data from this browser. Check your connection and try again.')
  }

  const payload = (await response.json().catch(() => null)) as
    (Record<string, unknown> & { message?: string; status?: string; code?: number }) | null
  if (!response.ok || !payload || payload.status === 'error' || payload.code) {
    const detail = payload?.message
    if (response.status === 401 || payload?.code === 401) {
      throw new Error('Twelve Data rejected the API key. Check the key entered above.')
    }
    if (response.status === 429 || payload?.code === 429) {
      throw new Error('Twelve Data rate limit reached. Wait before searching or refreshing again.')
    }
    if (detail?.toLowerCase().includes('isin')) {
      throw new Error(`${detail} ISIN search may require enabling Twelve Data’s ISIN add-on.`)
    }
    throw new Error(detail || `Twelve Data request failed (${response.status}).`)
  }
  return payload as T
}

export async function searchTwelveDataInstruments(
  query: string,
  apiKey: string,
): Promise<TwelveDataInstrument[]> {
  if (!apiKey.trim()) throw new Error('Enter and save your Twelve Data API key first.')
  const payload = await requestJson<{
    data?: TwelveDataInstrument[]
    status?: string
    message?: string
    code?: number
  }>('/symbol_search', { symbol: query.trim(), outputsize: '20' }, apiKey)
  return (payload.data ?? []).filter(
    (instrument) => instrument.symbol && instrument.instrument_name && instrument.currency,
  )
}

export async function fetchTwelveDataDailyPrices(
  instrument: TwelveDataInstrument,
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<TwelveDataSeries> {
  if (!apiKey.trim()) throw new Error('Enter and save your Twelve Data API key first.')
  const payload = await requestJson<{
    meta?: {
      symbol?: string
      exchange?: string
      currency?: string
      type?: string
    }
    values?: Array<{ datetime?: string; close?: string }>
    status?: string
    message?: string
    code?: number
  }>(
    '/time_series',
    {
      symbol: instrument.symbol,
      interval: '1day',
      start_date: startDate,
      end_date: endDate,
      outputsize: '5000',
      order: 'asc',
      adjust: 'all',
    },
    apiKey,
  )

  const priceByDate = new Map<string, number>()
  for (const value of payload.values ?? []) {
    const date = value.datetime?.slice(0, 10)
    const close = Number(value.close)
    if (date && Number.isFinite(close) && close > 0) priceByDate.set(date, close)
  }
  const prices = [...priceByDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((left, right) => left.date.localeCompare(right.date))
  if (prices.length < 2) {
    throw new Error(`Twelve Data returned fewer than two daily closes for ${instrument.symbol}.`)
  }

  return {
    instrument: {
      ...instrument,
      symbol: payload.meta?.symbol || instrument.symbol,
      exchange: payload.meta?.exchange || instrument.exchange,
      currency: payload.meta?.currency || instrument.currency,
      instrument_type: payload.meta?.type || instrument.instrument_type,
    },
    prices,
  }
}
