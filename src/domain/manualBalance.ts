import { MAX_MINOR_UNITS } from './money'
import type { ManualBalance, MinorUnits } from './models'

export const USD_BALANCE_ID = 'usd-balance'

/** El saldo en dólares puede ser cero (para vaciarlo) pero nunca negativo ni absurdamente grande. */
export function validateUsdBalance(amount: MinorUnits | null): string | null {
  if (amount === null) return 'Ingresá un monto válido, por ejemplo 1.000 o 1.250,50.'
  if (!Number.isSafeInteger(amount) || amount < 0) return 'El monto no puede ser negativo.'
  if (amount > MAX_MINOR_UNITS) return 'El monto es demasiado grande.'
  return null
}

export function buildUsdBalance(amount: MinorUnits, now: Date): ManualBalance {
  return { id: USD_BALANCE_ID, currency: 'USD', amount, updatedAt: now.toISOString() }
}
