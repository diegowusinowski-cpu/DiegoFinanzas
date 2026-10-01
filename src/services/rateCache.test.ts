import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '@/data/storage'
import { CachingRateProvider } from './rateCache'
import { RateUnavailableError, type ExchangeRate, type ExchangeRateProvider } from './rates'

const RATE: ExchangeRate = {
  pair: 'USD_BLUE_ARS',
  buy: 1385,
  sell: 1405.5,
  updatedAt: '2026-09-30T15:05:00.000Z',
  fetchedAt: '2026-09-30T15:10:00.000Z',
  source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
}
const ok = (rate = RATE): ExchangeRateProvider => ({ getUsdBlue: async () => rate })
const failing: ExchangeRateProvider = {
  getUsdBlue: async () => {
    throw new RateUnavailableError()
  },
}

describe('CachingRateProvider', () => {
  it('sin nada guardado no inventa ningún valor', () => {
    expect(new CachingRateProvider(failing, new MemoryStorage()).getCached()).toBeNull()
  })

  it('guarda la última cotización válida de la fuente y la recupera en otra sesión', async () => {
    const storage = new MemoryStorage()
    await expect(new CachingRateProvider(ok(), storage).getUsdBlue()).resolves.toEqual(RATE)
    expect(new CachingRateProvider(failing, storage).getCached()).toEqual(RATE)
  })

  it('si la fuente falla, el error se propaga y la última cotización válida queda intacta', async () => {
    const storage = new MemoryStorage()
    await new CachingRateProvider(ok(), storage).getUsdBlue()
    const provider = new CachingRateProvider(failing, storage)
    await expect(provider.getUsdBlue()).rejects.toBeInstanceOf(RateUnavailableError)
    expect(provider.getCached()).toEqual(RATE)
  })

  it('cada cotización nueva válida reemplaza a la anterior', async () => {
    const storage = new MemoryStorage()
    await new CachingRateProvider(ok(), storage).getUsdBlue()
    const newer = { ...RATE, buy: 1400, sell: 1420, fetchedAt: '2026-10-01T15:00:00.000Z' }
    await new CachingRateProvider(ok(newer), storage).getUsdBlue()
    expect(new CachingRateProvider(failing, storage).getCached()).toEqual(newer)
  })

  it.each([
    ['JSON roto', '{no'],
    ['forma inesperada', JSON.stringify({ buy: 1 })],
    ['valores no positivos', JSON.stringify({ ...RATE, buy: 0 })],
  ])('ignora un dato guardado inválido: %s', (_name, raw) => {
    const storage = new MemoryStorage()
    storage.setItem('dwf.v1.rate-usd-blue', raw)
    expect(new CachingRateProvider(failing, storage).getCached()).toBeNull()
  })

  it('si no se puede escribir, igualmente devuelve la cotización', async () => {
    const storage = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new Error('lleno') } }
    await expect(new CachingRateProvider(ok(), storage).getUsdBlue()).resolves.toEqual(RATE)
  })
})
