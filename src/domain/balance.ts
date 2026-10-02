import type { CurrencyCode, EntityId, MinorUnits, Transaction } from './models'

/** Efecto firmado de un movimiento sobre el saldo. Solo los COMPLETED cuentan. */
export function signedEffect(transaction: Transaction): MinorUnits {
  if (transaction.status !== 'COMPLETED') return 0
  return transaction.type === 'INCOME' ? transaction.amount : -transaction.amount
}

/**
 * Saldo derivado. Es la única fuente de verdad: nunca se persiste, siempre se
 * calcula a partir de los movimientos (evita desincronización). Las monedas
 * no se mezclan: se suma solo la moneda pedida (ARS por defecto).
 */
export function computeBalance(
  transactions: readonly Transaction[],
  accountId?: EntityId,
  currency: CurrencyCode = 'ARS',
): MinorUnits {
  return transactions.reduce(
    (total, t) =>
      t.currency === currency && (accountId === undefined || t.accountId === accountId)
        ? total + signedEffect(t)
        : total,
    0,
  )
}

export interface BalanceByMethod {
  /** Lo que entró y salió en efectivo. */
  cash: MinorUnits
  /** Lo que entró y salió por transferencia. */
  transfer: MinorUnits
  /** Movimientos sin medio de pago (p. ej. los de préstamos): no se reparten entre efectivo y transferencia. */
  other: MinorUnits
  /** Efectivo + transferencia + otros: es el mismo saldo de siempre. */
  total: MinorUnits
}

/** Saldo repartido por medio de pago (efectivo / transferencia). Mismo criterio que `computeBalance`. */
export function computeBalanceByMethod(
  transactions: readonly Transaction[],
  currency: CurrencyCode = 'ARS',
): BalanceByMethod {
  const result: BalanceByMethod = { cash: 0, transfer: 0, other: 0, total: 0 }
  for (const t of transactions) {
    if (t.currency !== currency) continue
    const effect = signedEffect(t)
    if (t.paymentMethod === 'CASH') result.cash += effect
    else if (t.paymentMethod === 'TRANSFER') result.transfer += effect
    else result.other += effect
    result.total += effect
  }
  return result
}
