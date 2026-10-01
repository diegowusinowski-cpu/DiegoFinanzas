// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import handler, {
  BLUELYTICS_RATE_SOURCE,
  BROWSER_RATE_SOURCES,
  DOLARAPI_RATE_SOURCE,
  SERVER_RATE_SOURCES,
  fetchBlueFromSources,
  parseBluelytics,
  parseDolarApi,
  type RateSource,
} from '../api/dolar-blue.ts'

const dolarhoyHtml = readFileSync(new URL('./fixtures/dolarhoy-home.html', import.meta.url), 'utf8')
const NOW = Date.parse('2026-10-01T12:00:00.000Z')
const dolarApiBody = (over: object = {}) =>
  JSON.stringify({ moneda: 'USD', casa: 'blue', nombre: 'Blue', compra: 1395, venta: 1415, fechaActualizacion: '2026-10-01T11:30:00.000Z', ...over })
const bluelyticsBody = (over: object = {}) =>
  JSON.stringify({
    oficial: { value_avg: 1300, value_sell: 1310, value_buy: 1290 },
    blue: { value_avg: 1400, value_sell: 1410, value_buy: 1390 },
    last_update: '2026-10-01T08:00:00.000000-03:00',
    ...over,
  })

/** fetch falso: responde según la URL; `null` simula caída de red. */
const routes = (table: Record<string, string | number | null>) =>
  vi.fn(async (url: string) => {
    const entry = Object.entries(table).find(([prefix]) => String(url).startsWith(prefix))?.[1]
    if (entry === null || entry === undefined) throw new TypeError('network down')
    return typeof entry === 'number' ? new Response('', { status: entry }) : new Response(entry)
  }) as unknown as typeof fetch

describe('lectores de las APIs públicas', () => {
  it('DolarAPI: compra, venta y fecha', () => {
    expect(parseDolarApi(dolarApiBody())).toEqual({ buy: 1395, sell: 1415, updatedAt: '2026-10-01T11:30:00.000Z' })
  })
  it('Bluelytics: usa el bloque blue (no el oficial) y su fecha con zona horaria', () => {
    expect(parseBluelytics(bluelyticsBody())).toEqual({ buy: 1390, sell: 1410, updatedAt: '2026-10-01T11:00:00.000Z' })
  })
  it.each([
    ['sin valores', '{}'],
    ['valores en texto', dolarApiBody({ compra: '1395' })],
    ['venta menor que compra', dolarApiBody({ compra: 1500, venta: 1000 })],
    ['cero', dolarApiBody({ compra: 0 })],
  ])('DolarAPI rechaza: %s', (_n, body) => {
    expect(() => parseDolarApi(body)).toThrow()
  })
  it('Bluelytics rechaza una respuesta sin el bloque blue', () => {
    expect(() => parseBluelytics(JSON.stringify({ oficial: { value_buy: 1, value_sell: 2 } }))).toThrow()
  })
  it('una fecha ilegible queda en null (no se inventa)', () => {
    expect(parseDolarApi(dolarApiBody({ fechaActualizacion: 'ayer' })).updatedAt).toBeNull()
  })
})

describe('fetchBlueFromSources: respaldo entre fuentes', () => {
  const options = (fetchImpl: typeof fetch, sources = SERVER_RATE_SOURCES) => ({ sources, fetchImpl, now: () => NOW })

  it('usa DolarHoy cuando responde y no consulta las demás', async () => {
    const fetchImpl = routes({ 'https://dolarhoy.com': dolarhoyHtml })
    const result = await fetchBlueFromSources(options(fetchImpl))
    expect(result.source.name).toBe('DolarHoy.com')
    expect(result.quote).toMatchObject({ buy: 1385, sell: 1405.5 })
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1)
  })

  it('si DolarHoy está caído usa DolarAPI', async () => {
    const result = await fetchBlueFromSources(options(routes({ 'https://dolarhoy.com': 503, 'https://dolarapi.com': dolarApiBody() })))
    expect(result.source).toEqual({ name: 'DolarAPI.com', url: 'https://dolarapi.com/' })
    expect(result.quote.buy).toBe(1395)
  })

  it('si DolarHoy cambió su HTML (no se puede leer) también pasa a la siguiente', async () => {
    const result = await fetchBlueFromSources(options(routes({ 'https://dolarhoy.com': '<html>nuevo diseño</html>', 'https://dolarapi.com': dolarApiBody() })))
    expect(result.source.name).toBe('DolarAPI.com')
  })

  it('si DolarHoy y DolarAPI fallan usa Bluelytics', async () => {
    const result = await fetchBlueFromSources(
      options(routes({ 'https://dolarhoy.com': null, 'https://dolarapi.com': 500, 'https://api.bluelytics.com.ar': bluelyticsBody() })),
    )
    expect(result.source.name).toBe('Bluelytics')
    expect(result.quote).toMatchObject({ buy: 1390, sell: 1410 })
  })

  it('JSON roto en una fuente no frena a las demás', async () => {
    const result = await fetchBlueFromSources(
      options(routes({ 'https://dolarhoy.com': 503, 'https://dolarapi.com': '<html>', 'https://api.bluelytics.com.ar': bluelyticsBody() })),
    )
    expect(result.source.name).toBe('Bluelytics')
  })

  it('si todas fallan lanza error y no inventa valores', async () => {
    await expect(fetchBlueFromSources(options(routes({})))).rejects.toMatchObject({ code: 'source_unavailable' })
    await expect(
      fetchBlueFromSources(options(routes({ 'https://dolarhoy.com': '<p/>', 'https://dolarapi.com': '{}', 'https://api.bluelytics.com.ar': '{}' }))),
    ).rejects.toMatchObject({ code: 'parse_failed' })
  })

  it('un dato demasiado viejo se descarta si otra fuente tiene uno más reciente', async () => {
    const old = dolarApiBody({ fechaActualizacion: '2026-09-20T12:00:00.000Z' })
    const result = await fetchBlueFromSources(options(routes({ 'https://dolarapi.com': old, 'https://api.bluelytics.com.ar': bluelyticsBody() }), BROWSER_RATE_SOURCES))
    expect(result.source.name).toBe('Bluelytics')
  })

  it('si todas devuelven datos viejos se devuelve el más nuevo con su fecha real', async () => {
    const older = dolarApiBody({ fechaActualizacion: '2026-09-18T12:00:00.000Z' })
    const old = bluelyticsBody({ last_update: '2026-09-25T12:00:00-03:00' })
    const result = await fetchBlueFromSources(options(routes({ 'https://dolarapi.com': older, 'https://api.bluelytics.com.ar': old }), BROWSER_RATE_SOURCES))
    expect(result.source.name).toBe('Bluelytics')
    expect(result.quote.updatedAt).toBe('2026-09-25T15:00:00.000Z')
  })

  it('una fuente sin fecha se acepta (se muestra como "Consultado")', async () => {
    const result = await fetchBlueFromSources(options(routes({ 'https://dolarapi.com': dolarApiBody({ fechaActualizacion: undefined }) }), [DOLARAPI_RATE_SOURCE]))
    expect(result.quote.updatedAt).toBeNull()
  })

  it('el navegador (sin servidor) solo usa APIs públicas con CORS, nunca DolarHoy directo', () => {
    expect(BROWSER_RATE_SOURCES.map((s) => s.id)).toEqual(['dolarapi', 'bluelytics'])
    expect(SERVER_RATE_SOURCES.map((s) => s.id)).toEqual(['dolarhoy', 'dolarapi', 'bluelytics'])
  })

  it('cancelar corta la búsqueda', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchBlueFromSources({ ...options(routes({})), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('cada fuente usa su dirección real', () => {
    const urls = (s: RateSource) => s.endpoints
    expect(urls(DOLARAPI_RATE_SOURCE)).toEqual(['https://dolarapi.com/v1/dolares/blue'])
    expect(urls(BLUELYTICS_RATE_SOURCE)).toEqual(['https://api.bluelytics.com.ar/v2/latest'])
  })
})

describe('función /api/dolar-blue con respaldo', () => {
  it('si DolarHoy falla responde con la fuente que sí contestó', async () => {
    const original = globalThis.fetch
    globalThis.fetch = routes({ 'https://dolarhoy.com': 503, 'https://dolarapi.com': dolarApiBody({ fechaActualizacion: new Date().toISOString() }) })
    let status = 0
    let json: unknown
    const res = {
      status(code: number) {
        status = code
        return res
      },
      setHeader: () => undefined,
      json: (body: unknown) => {
        json = body
      },
      end: () => undefined,
    }
    try {
      await handler({ method: 'GET' }, res)
    } finally {
      globalThis.fetch = original
    }
    expect(status).toBe(200)
    expect(json).toMatchObject({ buy: 1395, sell: 1415, source: { name: 'DolarAPI.com' } })
  })
})
