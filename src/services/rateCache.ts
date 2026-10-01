import type { KeyValueStorage } from '@/data/storage'
import type { ExchangeRate, ExchangeRateProvider } from './rates'

const CACHE_KEY = 'dwf.v1.rate-usd-blue'

function isExchangeRate(value: unknown): value is ExchangeRate {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0
  return (
    v.pair === 'USD_BLUE_ARS' &&
    positive(v.buy) &&
    positive(v.sell) &&
    typeof v.fetchedAt === 'string' &&
    (v.updatedAt === null || typeof v.updatedAt === 'string') &&
    typeof v.source === 'object' &&
    v.source !== null
  )
}

/**
 * Guarda la última cotización VÁLIDA que devolvió la fuente real. Solo se escribe cuando la fuente
 * respondió bien: si falla, la app conserva este dato (con su fecha de actualización) y nunca lo
 * reemplaza por un valor inventado.
 */
export class CachingRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly inner: ExchangeRateProvider,
    private readonly storage: KeyValueStorage,
  ) {}

  getCached(): ExchangeRate | null {
    try {
      const raw = this.storage.getItem(CACHE_KEY)
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      return isExchangeRate(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  async getUsdBlue(signal?: AbortSignal): Promise<ExchangeRate> {
    const rate = await this.inner.getUsdBlue(signal)
    try {
      this.storage.setItem(CACHE_KEY, JSON.stringify(rate))
    } catch {
      // sin espacio o sin storage: se muestra igual, solo que no queda guardada
    }
    return rate
  }
}
