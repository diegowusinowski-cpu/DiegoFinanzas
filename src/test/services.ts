import { createLocalRepositories } from '@/data/localRepositories'
import { MemoryStorage } from '@/data/storage'
import type { AppServices } from '@/services/container'
import { LocalPinAuthService } from '@/services/localPinAuth'
import { RateUnavailableError, type ExchangeRate, type ExchangeRateProvider } from '@/services/rates'

export const SAMPLE_RATE: ExchangeRate = {
  pair: 'USD_BLUE_ARS',
  buy: 1385,
  sell: 1405.5,
  updatedAt: '2026-10-06T15:05:00.000Z',
  fetchedAt: '2026-10-06T15:10:00.000Z',
  source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
}

export function fakeRates(behavior: 'ready' | 'unavailable' = 'ready'): ExchangeRateProvider {
  return {
    getUsdBlue: () =>
      behavior === 'ready' ? Promise.resolve(SAMPLE_RATE) : Promise.reject(new RateUnavailableError()),
  }
}

/** Servicios en memoria con un reloj que avanza 1 s por lectura (determinista). */
export function createTestServices(over: Partial<AppServices> = {}): AppServices {
  const storage = new MemoryStorage()
  let tick = 0
  const base = new Date(2026, 9, 6, 12, 0, 0).getTime()
  let id = 0
  return {
    repositories: createLocalRepositories(storage),
    auth: new LocalPinAuthService(storage),
    rates: fakeRates(),
    session: new MemoryStorage(),
    persistent: true,
    now: () => new Date(base + tick++ * 1000),
    newId: () => `id-${++id}`,
    ...over,
  }
}
