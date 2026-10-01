import { ApiClient, ApiError, ApiUnreachableError } from '@/data/apiClient'
import { createRepositories } from '@/data/documentRepositories'
import { createLocalRepositories } from '@/data/localRepositories'
import type { Repositories } from '@/data/repositories'
import { RemoteDocumentStore } from '@/data/remoteStore'
import { createBrowserStorage, type KeyValueStorage } from '@/data/storage'
import type { AuthService } from './auth'
import { DolarHoyRateProvider } from './dolarHoyProvider'
import { newId } from './ids'
import { LiveRateProvider } from './liveRateProvider'
import { LocalPinAuthService } from './localPinAuth'
import { CachingRateProvider } from './rateCache'
import type { ExchangeRateProvider } from './rates'
import { BrowserShareService, type ReceiptService, type ShareService } from './receipt'
import { CanvasReceiptService } from './receiptRenderer'
import { RemoteAuthService } from './remoteAuth'

/**
 * Dónde viven los datos:
 *  - `database`: en la base de datos real (PostgreSQL) a través del backend. Es el modo de producción.
 *  - `local`: sin servidor (previsualización o sitio estático): solo en este navegador.
 *  - `unconfigured`: hay backend pero falta configurar la base de datos (no se guarda nada).
 */
export type DataMode = 'database' | 'local' | 'unconfigured'

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
  dataMode: DataMode
  now: () => Date
  newId: () => string
}

const SESSION_KEY = 'dwf.session'
const HEALTH_TIMEOUT_MS = 6_000

/** Colecciones con datos cargados por la persona (no incluye cuenta/PIN ni categorías). */
const RESETTABLE_KEYS = [
  'transactions',
  'loans',
  'loan-installments',
  'savings-jars',
  'savings-contributions',
  'manual-balances',
].map((name) => `dwf.v1.${name}`)

/**
 * Solo la previsualización: si el build trae `VITE_RESET_TOKEN`, la primera vez que se abre con ese
 * token borra los datos de prueba guardados en este navegador (movimientos, préstamos, cuotas,
 * ahorros y dólares). Después no vuelve a borrar nada. En producción no se define: no hace nada.
 */
export function applyPreviewReset(storage: KeyValueStorage, token: string | undefined = import.meta.env.VITE_RESET_TOKEN): void {
  if (!token) return
  try {
    if (storage.getItem('dwf.reset-token') === token) return
    for (const key of RESETTABLE_KEYS) storage.removeItem(key)
    storage.setItem('dwf.reset-token', token)
  } catch {
    // sin acceso al almacenamiento: no hay nada que limpiar
  }
}

export async function detectDataMode(
  client: ApiClient,
  forced: string | undefined = import.meta.env.VITE_DATA_MODE,
): Promise<DataMode> {
  if (forced === 'local') return 'local'
  try {
    await client.call('health', {}, HEALTH_TIMEOUT_MS)
    return 'database'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'db_not_configured') return 'unconfigured'
    // Hay un sitio sin backend (estático): respaldo local. Sin conexión o base caída: SIEMPRE modo base
    // de datos, para no guardar datos en el dispositivo creyendo que están en la base.
    if (error instanceof ApiUnreachableError && error.reason === 'no-backend') return 'local'
    return 'database'
  }
}

/** Servicios cuando falta la base de datos: nada se lee ni se guarda, y se explica por qué. */
function unconfiguredRepositories(message: string): Repositories {
  const fail = async (): Promise<never> => {
    throw new Error(message)
  }
  return createRepositories({ read: fail, apply: fail })
}

class UnconfiguredAuth implements AuthService {
  constructor(private readonly message: string) {}
  async getProfile(): Promise<never> {
    throw new Error(this.message)
  }
  async enroll(): Promise<never> {
    throw new Error(this.message)
  }
  async verifyPin(): Promise<never> {
    throw new Error(this.message)
  }
  async getLockedUntil(): Promise<null> {
    return null
  }
  async resetAccess(): Promise<void> {}
}

const UNCONFIGURED_MESSAGE =
  'La base de datos no está configurada: falta la variable DATABASE_URL en el hosting. Mirá el README (sección Producción).'

export async function createAppServices(): Promise<AppServices> {
  const { storage, persistent } = createBrowserStorage()
  let session: KeyValueStorage = storage
  try {
    session = window.sessionStorage
  } catch {
    // sin sessionStorage: la sesión cae al storage principal
  }
  applyPreviewReset(storage)

  const client = new ApiClient('/api/dwf', undefined, () => {
    // La sesión venció: se vuelve a pedir el PIN.
    session.removeItem(SESSION_KEY)
    window.location.reload()
  })
  const mode = await detectDataMode(client)

  const common = {
    // Cotización: servidor propio y APIs públicas; la última válida se guarda en el dispositivo (es solo una caché).
    rates: new CachingRateProvider(new LiveRateProvider(new DolarHoyRateProvider()), storage),
    receipts: new CanvasReceiptService(),
    sharing: new BrowserShareService(),
    session,
    now: () => new Date(),
    newId,
    dataMode: mode,
  }

  if (mode === 'database') {
    return {
      ...common,
      repositories: createRepositories(new RemoteDocumentStore(client)),
      auth: new RemoteAuthService(client),
      persistent: true,
    }
  }
  if (mode === 'unconfigured') {
    return {
      ...common,
      repositories: unconfiguredRepositories(UNCONFIGURED_MESSAGE),
      auth: new UnconfiguredAuth(UNCONFIGURED_MESSAGE),
      persistent: true,
    }
  }
  return {
    ...common,
    repositories: createLocalRepositories(storage),
    auth: new LocalPinAuthService(storage),
    persistent,
  }
}

