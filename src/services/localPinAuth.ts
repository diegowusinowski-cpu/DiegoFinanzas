import type { Profile } from '@/domain'
import type { KeyValueStorage } from '@/data/storage'
import {
  DEFAULT_DISPLAY_NAME,
  isValidPin,
  normalizePhone,
  type AuthService,
  type EnrollInput,
  type VerifyResult,
} from './auth'

const CREDENTIALS_KEY = 'dwf.v1.auth'
const PBKDF2_ITERATIONS = 210_000
const MAX_FREE_ATTEMPTS = 5
const BASE_LOCK_MS = 30_000
const MAX_LOCK_MS = 15 * 60_000

interface StoredCredentials {
  version: 1
  phone: string
  displayName: string
  /** Hash PBKDF2-SHA256 del PIN (base64). El PIN nunca se guarda. */
  hash: string
  salt: string
  iterations: number
  failedAttempts: number
  lockedUntil: number | null
  lockCount: number
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador no soporta el cifrado necesario para proteger el PIN.')
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

/** Comparación en tiempo constante para strings de igual formato. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Autenticación local por PIN de 4 dígitos.
 *
 * Es un bloqueo de dispositivo, no autenticación de servidor: el PIN se
 * guarda solo como hash con sal (PBKDF2) y hay bloqueo progresivo tras
 * intentos fallidos. La autenticación definitiva reemplazará esta clase.
 */
export class LocalPinAuthService implements AuthService {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private read(): StoredCredentials | null {
    const raw = this.storage.getItem(CREDENTIALS_KEY)
    if (raw === null) return null
    try {
      const parsed = JSON.parse(raw) as StoredCredentials
      if (parsed.version !== 1 || !parsed.hash || !parsed.salt || !parsed.phone) return null
      return parsed
    } catch {
      return null
    }
  }

  private write(credentials: StoredCredentials): void {
    this.storage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
  }

  async getProfile(): Promise<Profile | null> {
    const c = this.read()
    return c ? { phone: c.phone, displayName: c.displayName } : null
  }

  async enroll({ phone, pin }: EnrollInput): Promise<Profile> {
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error('Ingresá un número de teléfono válido.')
    if (!isValidPin(pin)) throw new Error('El PIN debe tener 4 dígitos.')
    const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
    const hash = await derive(pin, salt, PBKDF2_ITERATIONS)
    this.write({
      version: 1,
      phone: normalized,
      displayName: DEFAULT_DISPLAY_NAME,
      hash,
      salt: toBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      failedAttempts: 0,
      lockedUntil: null,
      lockCount: 0,
    })
    return { phone: normalized, displayName: DEFAULT_DISPLAY_NAME }
  }

  async getLockedUntil(): Promise<number | null> {
    const c = this.read()
    if (!c || c.lockedUntil === null) return null
    return c.lockedUntil > this.now() ? c.lockedUntil : null
  }

  async verifyPin(pin: string): Promise<VerifyResult> {
    const credentials = this.read()
    if (!credentials) return { status: 'invalid', attemptsLeft: 0 }

    const lockedUntil = await this.getLockedUntil()
    if (lockedUntil !== null) return { status: 'locked', retryAt: lockedUntil }

    const candidate = isValidPin(pin)
      ? await derive(pin, fromBase64(credentials.salt), credentials.iterations)
      : ''
    if (candidate !== '' && safeEqual(candidate, credentials.hash)) {
      this.write({ ...credentials, failedAttempts: 0, lockedUntil: null, lockCount: 0 })
      return { status: 'ok' }
    }

    const failedAttempts = credentials.failedAttempts + 1
    if (failedAttempts >= MAX_FREE_ATTEMPTS) {
      const lockCount = credentials.lockCount + 1
      const duration = Math.min(BASE_LOCK_MS * 2 ** (lockCount - 1), MAX_LOCK_MS)
      const retryAt = this.now() + duration
      this.write({ ...credentials, failedAttempts: 0, lockedUntil: retryAt, lockCount })
      return { status: 'locked', retryAt }
    }
    this.write({ ...credentials, failedAttempts })
    return { status: 'invalid', attemptsLeft: MAX_FREE_ATTEMPTS - failedAttempts }
  }

  async resetAccess(): Promise<void> {
    this.storage.removeItem(CREDENTIALS_KEY)
  }
}
