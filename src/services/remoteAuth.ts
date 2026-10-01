import type { Profile } from '@/domain'
import { ApiClient, ApiError } from '@/data/apiClient'
import { isValidPin, normalizePhone, type AuthService, type EnrollInput, type VerifyResult } from './auth'

interface ProfileReply {
  profile: Profile | null
  lockedUntil: number | null
  authenticated: boolean
}

/**
 * Acceso con PIN verificado en el servidor: el PIN viaja por HTTPS, se guarda solo como hash en la
 * base y los intentos fallidos se bloquean del lado del servidor. La sesión es una cookie HttpOnly.
 */
export class RemoteAuthService implements AuthService {
  constructor(private readonly client: ApiClient) {}

  async getProfile(): Promise<Profile | null> {
    return (await this.client.call<ProfileReply>('profile')).profile
  }

  async enroll({ phone, pin }: EnrollInput): Promise<Profile> {
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error('Ingresá un número de teléfono válido.')
    if (!isValidPin(pin)) throw new Error('El PIN debe tener 4 dígitos.')
    const { profile } = await this.client.call<{ profile: Profile }>('enroll', { phone: normalized, pin })
    return profile
  }

  async verifyPin(pin: string): Promise<VerifyResult> {
    return this.client.call<VerifyResult>('login', { pin })
  }

  async getLockedUntil(): Promise<number | null> {
    return (await this.client.call<ProfileReply>('profile')).lockedUntil
  }

  async signOut(): Promise<void> {
    await this.client.call('logout').catch(() => undefined)
  }

  /**
   * Con base de datos real no se puede "crear un PIN nuevo" desde la pantalla: cualquiera que abra el
   * sitio podría quedarse con tus datos. Se cierra la sesión y el cambio de PIN se hace con
   * `npm run db:reset-pin` (ver README).
   */
  async resetAccess(): Promise<void> {
    await this.signOut()
  }
}

export { ApiError }
