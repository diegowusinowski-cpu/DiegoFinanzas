import type { Profile } from '@/domain'

export const DEFAULT_DISPLAY_NAME = 'Diego'
export const PIN_LENGTH = 4

export type VerifyResult =
  | { status: 'ok' }
  | { status: 'invalid'; attemptsLeft: number }
  | { status: 'locked'; retryAt: number }

export interface EnrollInput {
  phone: string
  pin: string
}

/**
 * Contrato de autenticación. Hoy lo cumple un PIN local (`LocalPinAuthService`);
 * una autenticación real (backend, OTP por SMS, biometría) implementará esta
 * misma interfaz sin cambios en la UI.
 */
export interface AuthService {
  getProfile(): Promise<Profile | null>
  enroll(input: EnrollInput): Promise<Profile>
  verifyPin(pin: string): Promise<VerifyResult>
  /** Timestamp (ms) hasta el que el acceso está bloqueado, o `null`. */
  getLockedUntil(): Promise<number | null>
  /** Borra teléfono y PIN de este dispositivo (no toca los movimientos). */
  resetAccess(): Promise<void>
  /** Cierra la sesión en el servidor (solo si el acceso se verifica allí). */
  signOut?(): Promise<void>
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

/**
 * Normaliza un teléfono a dígitos con código de país. Sin `+` se asume
 * Argentina (54, con 9 para móviles). Devuelve `null` si no es plausible.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null
  let digits = trimmed.replace(/\D/g, '')
  if (!trimmed.startsWith('+')) {
    digits = digits.replace(/^0+/, '')
    if (digits.startsWith('54')) {
      // ya trae código de país
    } else if (digits.length >= 10 && digits.length <= 11) {
      digits = `549${digits}`
    }
  }
  if (digits.length < 10 || digits.length > 15) return null
  return `+${digits}`
}

/** `+5491123456789` → `+54 ••••••• 789` (nunca expone el número completo). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return '••••'
  const country = digits.slice(0, 2)
  const tail = digits.slice(-3)
  const hidden = '•'.repeat(Math.max(digits.length - 5, 3))
  return `+${country} ${hidden} ${tail}`
}
