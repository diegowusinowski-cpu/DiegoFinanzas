// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import handler from '../api/dolar-blue.ts'
import { DolarHoyError, fetchDolarHoyBlue, parseDolarHoyBlue, parseQuoteValue } from './dolarhoy.ts'
import { createRatesMiddleware } from './ratesApi.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

const fixture = readFileSync(new URL('./fixtures/dolarhoy-home.html', import.meta.url), 'utf8')

describe('parseDolarHoyBlue', () => {
  it('lee compra, venta y actualización del bloque Dólar Blue', () => {
    expect(parseDolarHoyBlue(fixture)).toEqual({
      buy: 1385,
      sell: 1405.5,
      updatedAt: '2026-09-30T15:05:00.000Z', // 12:05 en Argentina (UTC-3)
    })
  })

  it('ignora el menú y otros dólares', () => {
    const html = fixture.replace('$1.385', '$1.111')
    expect(parseDolarHoyBlue(html).buy).toBe(1111)
  })

  it('devuelve updatedAt null si la fuente no informa fecha', () => {
    const html = fixture.replace(/<div class="tile update">.*?<\/div>/s, '')
    expect(parseDolarHoyBlue(html).updatedAt).toBeNull()
  })

  it.each([
    ['30/09/26 12:05 PM', '2026-09-30T15:05:00.000Z'], // mediodía
    ['30/09/26 03:40 PM', '2026-09-30T18:40:00.000Z'], // 15:40 en Argentina
    ['30/09/26 09:15 AM', '2026-09-30T12:15:00.000Z'],
    ['01/10/26 12:20 AM', '2026-10-01T03:20:00.000Z'], // medianoche
    ['30/09/2026 15:40', '2026-09-30T18:40:00.000Z'], // 24 h
    ['30/09/26 3:40 p. m.', '2026-09-30T18:40:00.000Z'],
  ])('interpreta la hora de Argentina (UTC-3) con AM/PM: %s', (text, iso) => {
    const html = fixture.replace('30/09/26 12:05 PM', text)
    expect(parseDolarHoyBlue(html).updatedAt).toBe(iso)
  })

  it('lee el bloque correcto aunque el menú y otros dólares aparezcan antes', () => {
    expect(parseDolarHoyBlue(fixture)).toMatchObject({ buy: 1385, sell: 1405.5 })
    const onlyBlue = fixture.replace(/<div class="tile is-parent">.*?Dólar Oficial<\/a>.*?<\/div><\/div>\s*<\/div><\/div>/s, '')
    expect(parseDolarHoyBlue(onlyBlue)).toMatchObject({ buy: 1385, sell: 1405.5 })
  })

  it('si cambian las clases del sitio, igual lee por los rótulos de texto', () => {
    const html = fixture.replace(/class="[^"]*"/g, '')
    expect(parseDolarHoyBlue(html)).toMatchObject({ buy: 1385, sell: 1405.5 })
  })

  it('interpreta importes con y sin separadores', () => {
    expect(parseQuoteValue('$1385')).toBe(1385)
    expect(parseQuoteValue('$1.385')).toBe(1385)
    expect(parseQuoteValue('1.405,50')).toBe(1405.5)
    expect(parseQuoteValue('1385,5')).toBe(1385.5)
    expect(parseQuoteValue('—')).toBeNull()
    expect(parseQuoteValue('0')).toBeNull()
    expect(parseQuoteValue(undefined)).toBeNull()
  })

  it('acepta valores sin símbolo ni miles', () => {
    const html = '<b>Dólar Blue</b><i>Compra</i><i>1385</i><i>Venta</i><i>1405</i>'
    expect(parseDolarHoyBlue(html)).toMatchObject({ buy: 1385, sell: 1405 })
  })

  it.each([
    ['sin el bloque', '<html><body><p>Dólar Oficial</p></body></html>'],
    ['sin valores', '<b>Dólar Blue</b><i>Compra</i><i>—</i><i>Venta</i><i>—</i>'],
    ['venta menor que compra', '<b>Dólar Blue</b><i>Compra</i><i>$1500</i><i>Venta</i><i>$1000</i>'],
    ['diferencia absurda', '<b>Dólar Blue</b><i>Compra</i><i>$100</i><i>Venta</i><i>$1000</i>'],
    ['vacío', ''],
  ])('falla con parse_failed: %s', (_name, html) => {
    expect(() => parseDolarHoyBlue(html)).toThrowError(DolarHoyError)
    try {
      parseDolarHoyBlue(html)
    } catch (e) {
      expect((e as DolarHoyError).code).toBe('parse_failed')
    }
  })
})

describe('fetchDolarHoyBlue', () => {
  const respond = (body: string, status = 200) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch

  it('consulta dolarhoy.com y parsea', async () => {
    const fetchImpl = respond(fixture)
    await expect(fetchDolarHoyBlue(fetchImpl)).resolves.toMatchObject({ buy: 1385, sell: 1405.5 })
    expect(vi.mocked(fetchImpl).mock.calls[0]?.[0]).toBe('https://dolarhoy.com/')
  })

  it('si la portada falla, consulta la página propia del Dólar Blue (también de DolarHoy.com)', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      return url === 'https://dolarhoy.com/' ? new Response('', { status: 503 }) : new Response(fixture)
    }) as unknown as typeof fetch
    await expect(fetchDolarHoyBlue(fetchImpl)).resolves.toMatchObject({ buy: 1385, sell: 1405.5 })
    expect(calls).toEqual(['https://dolarhoy.com/', 'https://dolarhoy.com/cotizaciondolarblue'])
  })

  it('si la portada responde pero no se puede leer, también prueba la otra página', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === 'https://dolarhoy.com/' ? new Response('<html>cambió todo</html>') : new Response(fixture),
    ) as unknown as typeof fetch
    await expect(fetchDolarHoyBlue(fetchImpl)).resolves.toMatchObject({ buy: 1385 })
  })

  it('si ninguna página sirve, informa el error sin inventar valores', async () => {
    await expect(fetchDolarHoyBlue(respond('<html></html>'))).rejects.toMatchObject({ code: 'parse_failed' })
  })

  it('informa source_unavailable ante HTTP de error', async () => {
    await expect(fetchDolarHoyBlue(respond('', 503))).rejects.toMatchObject({ code: 'source_unavailable' })
  })

  it('informa source_unavailable ante error de red', async () => {
    const failing = vi.fn(async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    await expect(fetchDolarHoyBlue(failing)).rejects.toMatchObject({ code: 'source_unavailable' })
  })
})

describe('createRatesMiddleware', () => {
  const run = async (middleware: ReturnType<typeof createRatesMiddleware>, url = '/api/dolar-blue', method = 'GET') => {
    let status = 0
    let body = ''
    let nextCalled = false
    const res = {
      statusCode: 200,
      setHeader: () => undefined,
      end: (payload: string) => {
        status = res.statusCode
        body = payload
      },
    }
    middleware({ url, method } as IncomingMessage, res as unknown as ServerResponse, () => {
      nextCalled = true
    })
    await new Promise((r) => setTimeout(r, 0))
    return { status, body: body ? JSON.parse(body) : null, nextCalled }
  }

  it('responde el JSON con la fuente y cachea 60 s', async () => {
    let clock = 1_000
    const quote = vi.fn(async () => ({ quote: { buy: 1385, sell: 1405, updatedAt: null }, source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' } }))
    const mw = createRatesMiddleware(quote, () => clock)

    const first = await run(mw)
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ buy: 1385, sell: 1405, source: { name: 'DolarHoy.com' } })

    await run(mw)
    expect(quote).toHaveBeenCalledTimes(1)
    clock += 61_000
    await run(mw)
    expect(quote).toHaveBeenCalledTimes(2)
  })

  it('devuelve 502 sin inventar valores cuando la fuente falla', async () => {
    const mw = createRatesMiddleware(async () => {
      throw new DolarHoyError('source_unavailable', 'x')
    })
    const res = await run(mw)
    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'source_unavailable', message: 'La cotización no está disponible.' })
    expect(res.body).not.toHaveProperty('buy')
  })

  it('deja pasar otras rutas y rechaza métodos no GET', async () => {
    const mw = createRatesMiddleware(async () => ({ quote: { buy: 1, sell: 1, updatedAt: null }, source: { name: 'x', url: 'x' } }))
    expect((await run(mw, '/otra')).nextCalled).toBe(true)
    // El módulo fuente que sirve `vite dev` (`/api/dolar-blue.ts`) no se confunde con la API.
    expect((await run(mw, '/api/dolar-blue.ts')).nextCalled).toBe(true)
    expect((await run(mw, '/api/dolar-blue?x=1')).nextCalled).toBe(false)
    expect((await run(mw, '/api/dolar-blue', 'POST')).status).toBe(405)
  })
})

describe('función serverless /api/dolar-blue (Vercel)', () => {
  const call = async (method: string, quote?: () => Promise<Response>) => {
    const headers: Record<string, string> = {}
    let status = 0
    let json: unknown
    const res = {
      status(code: number) {
        status = code
        return res
      },
      setHeader: (name: string, value: string) => {
        headers[name] = value
      },
      json: (body: unknown) => {
        json = body
      },
      end: () => undefined,
    }
    const original = globalThis.fetch
    if (quote) globalThis.fetch = vi.fn(quote) as unknown as typeof fetch
    try {
      await handler({ method }, res)
    } finally {
      globalThis.fetch = original
    }
    return { status, json, headers }
  }

  it('responde la cotización leída de DolarHoy.com con CORS y caché de CDN', async () => {
    const { status, json, headers } = await call('GET', async () => new Response(fixture))
    expect(status).toBe(200)
    expect(json).toMatchObject({
      buy: 1385,
      sell: 1405.5,
      updatedAt: '2026-09-30T15:05:00.000Z',
      source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
    })
    expect(typeof (json as { fetchedAt: string }).fetchedAt).toBe('string')
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
    expect(headers['Cache-Control']).toMatch(/s-maxage=60/)
  })

  it('si DolarHoy falla responde 502 sin valores y sin cachear el error', async () => {
    const { status, json, headers } = await call('GET', async () => new Response('', { status: 503 }))
    expect(status).toBe(502)
    expect(json).toEqual({ error: 'source_unavailable', message: 'La cotización no está disponible.' })
    expect(headers['Cache-Control']).toBe('no-store')
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
  })

  it('responde el preflight CORS y rechaza otros métodos', async () => {
    expect((await call('OPTIONS')).status).toBe(204)
    expect((await call('POST')).status).toBe(405)
  })
})
