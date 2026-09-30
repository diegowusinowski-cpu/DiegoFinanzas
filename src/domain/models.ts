/**
 * Modelos del dominio de DWF.
 *
 * Reglas transversales:
 *  - Los montos se guardan como enteros en unidades menores (centavos) para
 *    evitar errores de punto flotante. Siempre son positivos: el signo lo da
 *    `Transaction.type`.
 *  - Las fechas/horas de negocio son strings locales (`YYYY-MM-DD` / `HH:mm`);
 *    los timestamps de auditoría son ISO 8601 en UTC.
 *  - Los movimientos nunca se eliminan físicamente: se cancelan.
 */

export type EntityId = string
export type IsoTimestamp = string
/** `YYYY-MM-DD` en hora local. */
export type LocalDate = string
/** `HH:mm` (24 h) en hora local. */
export type LocalTime = string
/** Entero en centavos. Siempre >= 0. */
export type MinorUnits = number

export type CurrencyCode = 'ARS'

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_STATUSES = ['COMPLETED', 'SCHEDULED', 'CANCELLED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export interface Account {
  id: EntityId
  name: string
  currency: CurrencyCode
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Category {
  id: EntityId
  name: string
  /** Tipo de movimiento al que aplica. */
  type: TransactionType
  /** Categoría del sistema: no editable por el usuario. */
  system: boolean
}

export interface Transaction {
  id: EntityId
  /** Preparado para cuentas múltiples. */
  accountId: EntityId
  type: TransactionType
  amount: MinorUnits
  description: string
  categoryId: EntityId
  date: LocalDate
  time: LocalTime
  status: TransactionStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/** Origen de un recordatorio. Permite que módulos futuros generen los suyos. */
export const REMINDER_SOURCE_KINDS = [
  'MANUAL',
  'LOAN',
  'INSTALLMENT',
  'RECEIVABLE',
  'TRANSACTION',
  'SCHEDULED_TRANSACTION',
] as const
export type ReminderSourceKind = (typeof REMINDER_SOURCE_KINDS)[number]

export interface ReminderSource {
  kind: ReminderSourceKind
  /** Id de la entidad que originó el recordatorio (préstamo, cuota, etc.). */
  refId?: EntityId
}

export const REMINDER_STATUSES = ['ACTIVE', 'DISMISSED', 'DONE'] as const
export type ReminderStatus = (typeof REMINDER_STATUSES)[number]

export interface Reminder {
  id: EntityId
  title: string
  description: string
  dueDate: LocalDate
  status: ReminderStatus
  source: ReminderSource
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Profile {
  /** Teléfono en formato E.164 sin espacios, p. ej. `+5491112345678`. */
  phone: string
  displayName: string
}
