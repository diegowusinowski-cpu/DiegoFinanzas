// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { DolarHoyError, fetchDolarHoyBlue, parseDolarHoyBlue } from './dolarhoy.ts'
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
    const quote = vi.fn(async () => ({ buy: 1385, sell: 1405, updatedAt: null }))
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
    const mw = createRatesMiddleware(async () => ({ buy: 1, sell: 1, updatedAt: null }))
    expect((await run(mw, '/otra')).nextCalled).toBe(true)
    expect((await run(mw, '/api/dolar-blue', 'POST')).status).toBe(405)
  })
})
