import { describe, expect, it, vi } from 'vitest'
import { LiveRateProvider } from './liveRateProvider'
import { RateUnavailableError, type ExchangeRate, type ExchangeRateProvider } from './rates'

const NOW = new Date('2026-10-01T12:00:00.000Z')
const SERVER_RATE: ExchangeRate = {
  pair: 'USD_BLUE_ARS',
  buy: 1385,
  sell: 1405.5,
  updatedAt: '2026-10-01T11:00:00.000Z',
  fetchedAt: '2026-10-01T11:59:00.000Z',
  source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
}
const server = (impl: () => Promise<ExchangeRate>): ExchangeRateProvider => ({ getUsdBlue: vi.fn(impl) })
const down = () => Promise.reject(new RateUnavailableError())
const publicApis = (table: Record<string, string | number | null>) =>
  vi.fn(async (url: string) => {
    const entry = Object.entries(table).find(([prefix]) => String(url).startsWith(prefix))?.[1]
    if (entry === null || entry === undefined) throw new TypeError('Failed to fetch')
    return typeof entry === 'number' ? new Response('', { status: entry }) : new Response(entry)
  }) as unknown as typeof fetch
const dolarApi = JSON.stringify({ compra: 1395, venta: 1415, fechaActualizacion: '2026-10-01T11:30:00.000Z' })
const bluelytics = JSON.stringify({ blue: { value_buy: 1390, value_sell: 1410 }, last_update: '2026-10-01T08:30:00-03:00' })

describe('LiveRateProvider', () => {
  it('usa el servidor propio (DolarHoy) cuando responde y no toca las APIs públicas', async () => {
    const fetchImpl = publicApis({})
    const rate = await new LiveRateProvider(server(async () => SERVER_RATE), fetchImpl, () => NOW).getUsdBlue()
    expect(rate).toEqual(SERVER_RATE)
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled()
  })

  it('sin servidor (hosting estático) consulta DolarAPI directo desde el navegador', async () => {
    const rate = await new LiveRateProvider(server(down), publicApis({ 'https://dolarapi.com': dolarApi }), () => NOW).getUsdBlue()
    expect(rate).toEqual({
      pair: 'USD_BLUE_ARS',
      buy: 1395,
      sell: 1415,
      updatedAt: '2026-10-01T11:30:00.000Z',
      fetchedAt: NOW.toISOString(),
      source: { name: 'DolarAPI.com', url: 'https://dolarapi.com/' },
    })
  })

  it('si DolarAPI falla pasa a Bluelytics', async () => {
    const rate = await new LiveRateProvider(
      server(down),
      publicApis({ 'https://dolarapi.com': 503, 'https://api.bluelytics.com.ar': bluelytics }),
      () => NOW,
    ).getUsdBlue()
    expect(rate.source.name).toBe('Bluelytics')
    expect(rate).toMatchObject({ buy: 1390, sell: 1410 })
  })

  it('si todo falla lanza RateUnavailableError (la app conserva la última cotización válida)', async () => {
    await expect(new LiveRateProvider(server(down), publicApis({}), () => NOW).getUsdBlue()).rejects.toBeInstanceOf(RateUnavailableError)
  })

  it('un servidor que devuelve la página de la app (404 → index.html) no rompe: sigue con las APIs', async () => {
    const brokenServer = server(() => Promise.reject(new RateUnavailableError()))
    const rate = await new LiveRateProvider(brokenServer, publicApis({ 'https://dolarapi.com': dolarApi }), () => NOW).getUsdBlue()
    expect(rate.source.name).toBe('DolarAPI.com')
  })

  it('al cancelar propaga la cancelación', async () => {
    const controller = new AbortController()
    const provider = new LiveRateProvider(
      server(async () => {
        controller.abort()
        throw new RateUnavailableError()
      }),
      publicApis({ 'https://dolarapi.com': dolarApi }),
      () => NOW,
    )
    await expect(provider.getUsdBlue(controller.signal)).rejects.toBeInstanceOf(RateUnavailableError)
  })
})
