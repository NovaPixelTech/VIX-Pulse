import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchTwelveDataDailyPrices,
  getTwelveDataApiKey,
  saveTwelveDataApiKey,
  searchTwelveDataInstruments,
  type TwelveDataInstrument,
} from './twelveData'

const instrument: TwelveDataInstrument = {
  symbol: 'RHM.DE',
  instrument_name: 'Rheinmetall AG',
  exchange: 'XETRA',
  country: 'Germany',
  currency: 'EUR',
  instrument_type: 'Common Stock',
}

afterEach(() => vi.unstubAllGlobals())

describe('Twelve Data browser API client', () => {
  it('stores the provider key only in local storage and supports removing it', () => {
    localStorage.clear()
    saveTwelveDataApiKey('  secret-key  ')
    expect(getTwelveDataApiKey()).toBe('secret-key')

    saveTwelveDataApiKey('')
    expect(getTwelveDataApiKey()).toBe('')
  })

  it('searches by identifier using the locally supplied key in the auth header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [instrument], status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchTwelveDataInstruments('Rheinmetall', 'secret-key')).resolves.toEqual([instrument])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/symbol_search?')
    expect(String(url)).toContain('symbol=Rheinmetall')
    expect(init.headers).toEqual({ Authorization: 'apikey secret-key' })
  })

  it('loads adjusted daily closes in chronological order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: { symbol: 'RHM.DE', exchange: 'XETRA', currency: 'EUR', type: 'Common Stock' },
          values: [
            { datetime: '2025-09-03', close: '110.50' },
            { datetime: '2025-09-02', close: '100.25' },
          ],
          status: 'ok',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const series = await fetchTwelveDataDailyPrices(instrument, 'secret-key', '2025-09-01', '2025-09-04')

    expect(series.prices).toEqual([
      { date: '2025-09-02', close: 100.25 },
      { date: '2025-09-03', close: 110.5 },
    ])
    expect(series.instrument.currency).toBe('EUR')
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('adjust=all')
    expect(String(url)).toContain('interval=1day')
    expect(String(url)).toContain('start_date=2025-09-01')
  })

  it('returns a useful error when the provider key is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 401, message: 'Invalid API key', status: 'error' }), {
        status: 401,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchTwelveDataInstruments('RHM.DE', 'bad-key')).rejects.toThrow(/rejected the API key/)
  })
})
