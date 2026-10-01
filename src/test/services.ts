import { createLocalRepositories } from '@/data/localRepositories'
import { MemoryStorage } from '@/data/storage'
import type { AppServices } from '@/services/container'
import { LocalPinAuthService } from '@/services/localPinAuth'
import type { Loan } from '@/domain'
import type { ReceiptService, ShareService } from '@/services/receipt'
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

/** Comprobante de prueba: registra los préstamos recibidos y devuelve un PNG falso. */
export function fakeReceipts() {
  const rendered: Array<{ loan: Loan; statusLabel: string }> = []
  const service: ReceiptService = {
    render: (loan, statusLabel) => {
      rendered.push({ loan, statusLabel })
      return Promise.resolve(new window.Blob(['png'], { type: 'image/png' }))
    },
  }
  return { service, rendered }
}

/** Compartir de prueba: `canShare` simula si el navegador soporta Web Share con archivos. */
export function fakeSharing(canShare: boolean) {
  const shared: Array<{ file: File; title: string }> = []
  const downloads: Array<{ blob: Blob; filename: string }> = []
  const service: ShareService = {
    canShareFile: () => canShare,
    shareFile: (file, message) => {
      shared.push({ file, title: message.title })
      return Promise.resolve('shared')
    },
    download: (blob, filename) => {
      downloads.push({ blob, filename })
    },
  }
  return { service, shared, downloads }
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
    receipts: fakeReceipts().service,
    sharing: fakeSharing(false).service,
    session: new MemoryStorage(),
    persistent: true,
    dataMode: 'database',
    now: () => new Date(base + tick++ * 1000),
    newId: () => `id-${++id}`,
    ...over,
  }
}
