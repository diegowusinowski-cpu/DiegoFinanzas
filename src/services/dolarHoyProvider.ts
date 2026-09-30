import { RateUnavailableError, type ExchangeRate, type ExchangeRateProvider } from './rates'

const DEFAULT_ENDPOINT = '/api/dolar-blue'
const REQUEST_TIMEOUT_MS = 10_000

interface DolarBlueResponse {
  buy: number
  sell: number
  updatedAt: string | null
  fetchedAt: string
  source: { name: string; url: string }
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isValidResponse(value: unknown): value is DolarBlueResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    isPositiveNumber(v.buy) &&
    isPositiveNumber(v.sell) &&
    typeof v.fetchedAt === 'string' &&
    (v.updatedAt === null || typeof v.updatedAt === 'string') &&
    typeof v.source === 'object' &&
    v.source !== null
  )
}

/**
 * Obtiene el Dólar Blue de DolarHoy.com a través del endpoint propio de la
 * app (`/api/dolar-blue`): el navegador no puede leer dolarhoy.com directo
 * (CORS), así que la lectura y el parseo ocurren del lado del servidor.
 */
export class DolarHoyRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly endpoint: string = import.meta.env.VITE_RATES_ENDPOINT ?? DEFAULT_ENDPOINT,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getUsdBlue(signal?: AbortSignal): Promise<ExchangeRate> {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
    const onAbort = () => timeout.abort()
    signal?.addEventListener('abort', onAbort)
    try {
      const response = await this.fetchImpl(this.endpoint, {
        headers: { Accept: 'application/json' },
        signal: timeout.signal,
      })
      if (!response.ok) throw new RateUnavailableError()
      const data: unknown = await response.json()
      if (!isValidResponse(data)) throw new RateUnavailableError()
      return {
        pair: 'USD_BLUE_ARS',
        buy: data.buy,
        sell: data.sell,
        updatedAt: data.updatedAt,
        fetchedAt: data.fetchedAt,
        source: data.source,
      }
    } catch (error) {
      if (signal?.aborted) throw error
      if (error instanceof RateUnavailableError) throw error
      throw new RateUnavailableError()
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}
