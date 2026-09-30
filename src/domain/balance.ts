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
