import { describe, expect, it, vi } from 'vitest'
import { DolarHoyRateProvider } from './dolarHoyProvider'
import { RateUnavailableError } from './rates'

const okBody = {
  buy: 1385,
  sell: 1405,
  updatedAt: '2026-09-30T15:05:00.000Z',
  fetchedAt: '2026-09-30T15:10:00.000Z',
  source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
}

const provider = (impl: () => Promise<Response>) => new DolarHoyRateProvider('/api/dolar-blue', vi.fn(impl) as unknown as typeof fetch)

describe('DolarHoyRateProvider', () => {
  it('mapea la respuesta a ExchangeRate', async () => {
    const rate = await provider(async () => Response.json(okBody)).getUsdBlue()
    expect(rate).toEqual({ pair: 'USD_BLUE_ARS', ...okBody })
  })

  it.each([
    ['HTTP 502', async () => new Response('{}', { status: 502 })],
    ['red caída', async () => Promise.reject(new TypeError('Failed to fetch'))],
    ['JSON inválido', async () => new Response('<html>', { status: 200 })],
    ['forma inesperada', async () => Response.json({ buy: 'x' })],
    ['valores no positivos', async () => Response.json({ ...okBody, buy: 0 })],
  ])('lanza RateUnavailableError: %s', async (_name, impl) => {
    await expect(provider(impl).getUsdBlue()).rejects.toBeInstanceOf(RateUnavailableError)
  })

  it('propaga la cancelación del llamador', async () => {
    const ctrl = new AbortController()
    const p = new DolarHoyRateProvider('/x', ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')))
      })) as unknown as typeof fetch)
    const pending = p.getUsdBlue(ctrl.signal)
    ctrl.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
