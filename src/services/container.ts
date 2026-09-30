import { createBrowserStorage, type KeyValueStorage } from '@/data/storage'
import { createLocalRepositories } from '@/data/localRepositories'
import type { Repositories } from '@/data/repositories'
import type { AuthService } from './auth'
import { DolarHoyRateProvider } from './dolarHoyProvider'
import { newId } from './ids'
import { LocalPinAuthService } from './localPinAuth'
import type { ExchangeRateProvider } from './rates'

/** Dependencias de la app. Los tests inyectan implementaciones en memoria. */
export interface AppServices {
  repositories: Repositories
  auth: AuthService
  rates: ExchangeRateProvider
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
    rates: new DolarHoyRateProvider(),
    session,
    persistent,
    now: () => new Date(),
    newId,
  }
}
