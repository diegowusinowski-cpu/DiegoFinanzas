import { dateTimeKey, isValidLocalDate, isValidLocalTime, localDateTimeToDate, toIso } from './datetime'
import { MAX_MINOR_UNITS } from './money'
import type {
  AccountHolder,
  Category,
  Country,
  CurrencyCode,
  EntityId,
  LocalDate,
  LocalTime,
  MinorUnits,
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from './models'
import { TRANSACTION_TYPES } from './models'

export const MAX_DESCRIPTION_LENGTH = 80

export interface NewTransactionInput {
  accountId: EntityId
  type: TransactionType
  amount: MinorUnits
  description: string
  categoryId: EntityId
  date: LocalDate
  time: LocalTime
  /** Por defecto Argentina / ARS / Individual. */
  country?: Country
  currency?: CurrencyCode
  holder?: AccountHolder
  paymentMethod?: PaymentMethod | null
}

export type TransactionField = 'amount' | 'description' | 'categoryId' | 'date' | 'time' | 'type'
export type ValidationErrors = Partial<Record<TransactionField, string>>

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function validateNewTransaction(
  input: NewTransactionInput,
  categories: readonly Category[],
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!TRANSACTION_TYPES.includes(input.type)) errors.type = 'Tipo de movimiento inválido.'

  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    errors.amount = 'Ingresá un monto mayor a cero.'
  } else if (input.amount > MAX_MINOR_UNITS) {
    errors.amount = 'El monto es demasiado grande.'
  }

  const description = input.description.trim()
  if (description === '') errors.description = 'Escribí una descripción.'
  else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`
  }

  const category = categories.find((c) => c.id === input.categoryId)
  if (!category) errors.categoryId = 'Elegí una categoría.'
  else if (category.type !== input.type) {
    errors.categoryId = 'La categoría no corresponde al tipo de movimiento.'
  }

  if (!isValidLocalDate(input.date)) errors.date = 'Fecha inválida.'
  if (!isValidLocalTime(input.time)) errors.time = 'Hora inválida.'

  return errors
}

/**
 * Estado inicial de un movimiento nuevo: si ocurre en el futuro queda
 * `SCHEDULED` (no afecta el saldo hasta que llegue su momento).
 */
export function initialStatus(date: LocalDate, time: LocalTime, now: Date): TransactionStatus {
  return localDateTimeToDate(date, time).getTime() > now.getTime() ? 'SCHEDULED' : 'COMPLETED'
}

/** Moneda en la que opera cada país. */
export function currencyForCountry(country: Country): CurrencyCode {
  return country === 'US' ? 'USD' : 'ARS'
}

export function buildTransaction(
  input: NewTransactionInput,
  meta: { id: EntityId; now: Date },
): Transaction {
  const timestamp = toIso(meta.now)
  return {
    id: meta.id,
    accountId: input.accountId,
    type: input.type,
    amount: input.amount,
    description: input.description.trim(),
    categoryId: input.categoryId,
    country: input.country ?? 'AR',
    currency: input.currency ?? currencyForCountry(input.country ?? 'AR'),
    holder: input.holder ?? 'INDIVIDUAL',
    paymentMethod: input.paymentMethod ?? null,
    date: input.date,
    time: input.time,
    status: initialStatus(input.date, input.time, meta.now),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Pasa a `COMPLETED` los movimientos programados cuyo momento ya llegó. */
export function settleDueTransactions(
  transactions: readonly Transaction[],
  now: Date,
): { transactions: Transaction[]; changed: Transaction[] } {
  const changed: Transaction[] = []
  const next = transactions.map((t) => {
    if (t.status !== 'SCHEDULED') return t
    if (localDateTimeToDate(t.date, t.time).getTime() > now.getTime()) return t
    const settled: Transaction = { ...t, status: 'COMPLETED', updatedAt: toIso(now) }
    changed.push(settled)
    return settled
  })
  return { transactions: next, changed }
}

/** Anulación lógica: el movimiento se conserva con estado `CANCELLED`. */
export function cancelTransaction(transaction: Transaction, now: Date): Transaction {
  if (transaction.status === 'CANCELLED') return transaction
  return { ...transaction, status: 'CANCELLED', updatedAt: toIso(now) }
}

/** Más recientes primero (fecha/hora del movimiento; desempata por alta). */
export function compareByRecency(a: Transaction, b: Transaction): number {
  const byMoment = dateTimeKey(b.date, b.time).localeCompare(dateTimeKey(a.date, a.time))
  if (byMoment !== 0) return byMoment
  return b.createdAt.localeCompare(a.createdAt)
}

export function sortByRecency(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(compareByRecency)
}

/** Los `limit` movimientos efectivos (COMPLETED) más recientes. */
export function latestTransactions(
  transactions: readonly Transaction[],
  limit: number,
): Transaction[] {
  return sortByRecency(transactions.filter((t) => t.status === 'COMPLETED')).slice(0, limit)
}
