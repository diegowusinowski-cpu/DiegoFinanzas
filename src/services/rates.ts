export type RatePair = 'USD_BLUE_ARS'

export interface ExchangeRate {
  pair: RatePair
  /** Cotización en pesos por dólar. */
  buy: number
  sell: number
  /** Última actualización informada por la fuente (ISO), si está disponible. */
  updatedAt: string | null
  fetchedAt: string
  source: { name: string; url: string }
}

/**
 * Contrato de cotizaciones. La fuente actual es DolarHoy.com
 * (`DolarHoyRateProvider`); cambiarla implica solo escribir otro proveedor.
 */
export interface ExchangeRateProvider {
  getUsdBlue(signal?: AbortSignal): Promise<ExchangeRate>
  /** Última cotización válida guardada en el dispositivo (si el proveedor la conserva). */
  getCached?(): ExchangeRate | null
}

export class RateUnavailableError extends Error {
  constructor(message = 'La cotización no está disponible en este momento.') {
    super(message)
    this.name = 'RateUnavailableError'
  }
}
