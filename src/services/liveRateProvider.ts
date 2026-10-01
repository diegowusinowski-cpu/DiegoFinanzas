import { BROWSER_RATE_SOURCES, fetchBlueFromSources } from '../../api/dolar-blue'
import { RateUnavailableError, type ExchangeRate, type ExchangeRateProvider } from './rates'

/**
 * Cotización del Dólar Blue sin configuración: primero el servidor propio (`/api/dolar-blue`, que lee
 * DolarHoy.com y tiene sus propios respaldos) y, si no existe o falla, las APIs públicas con CORS
 * (DolarAPI y Bluelytics) consultadas directo desde el navegador. Así funciona igual en local, en un
 * hosting con servidor y en un hosting estático.
 */
export class LiveRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly server: ExchangeRateProvider,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getUsdBlue(signal?: AbortSignal): Promise<ExchangeRate> {
    try {
      return await this.server.getUsdBlue(signal)
    } catch (error) {
      if (signal?.aborted) throw error
    }
    try {
      const { quote, source } = await fetchBlueFromSources({
        sources: BROWSER_RATE_SOURCES,
        fetchImpl: this.fetchImpl,
        signal,
        now: () => this.now().getTime(),
      })
      return {
        pair: 'USD_BLUE_ARS',
        buy: quote.buy,
        sell: quote.sell,
        updatedAt: quote.updatedAt,
        fetchedAt: this.now().toISOString(),
        source,
      }
    } catch (error) {
      if (signal?.aborted) throw error
      throw new RateUnavailableError()
    }
  }
}
