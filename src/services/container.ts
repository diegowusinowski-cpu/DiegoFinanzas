import { createBrowserStorage, type KeyValueStorage } from '@/data/storage'
import { createLocalRepositories } from '@/data/localRepositories'
import type { Repositories } from '@/data/repositories'
import type { AuthService } from './auth'
import { DolarHoyRateProvider } from './dolarHoyProvider'
import { newId } from './ids'
import { LocalPinAuthService } from './localPinAuth'
import { CachingRateProvider } from './rateCache'
import type { ExchangeRateProvider } from './rates'
import { BrowserShareService, type ReceiptService, type ShareService } from './receipt'
import { CanvasReceiptService } from './receiptRenderer'

/** Dependencias de la app. Los tests inyectan implementaciones en memoria. */
export interface AppServices {
  repositories: Repositories
  auth: AuthService
  rates: ExchangeRateProvider
  /** Imagen del comprobante de préstamo. */
  receipts: ReceiptService
  /** Compartir/guardar la imagen. */
  sharing: ShareService
  /** Sesión de la pestaña (se pierde al cerrarla). */
  session: KeyValueStorage
  /** `false` si los datos no podrán conservarse entre visitas. */
  persistent: boolean
  now: () => Date
  newId: () => string
}

export function createAppServices(): AppServices {
  const { storage, persistent } = createBrowserStorage()
  let session: KeyValueStorage = storage
  try {
    session = window.sessionStorage
  } catch {
    // sin sessionStorage: la sesión cae al storage principal
  }
  return {
    repositories: createLocalRepositories(storage),
    auth: new LocalPinAuthService(storage),
    rates: new CachingRateProvider(new DolarHoyRateProvider(), storage),
    receipts: new CanvasReceiptService(),
    sharing: new BrowserShareService(),
    session,
    persistent,
    now: () => new Date(),
    newId,
  }
}
