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

export type CurrencyCode = 'ARS' | 'USD'

export const COUNTRIES = ['AR', 'US'] as const
export type Country = (typeof COUNTRIES)[number]

/** Titular del movimiento (por ahora solo personas). */
export type AccountHolder = 'INDIVIDUAL'

/** Tipo de operación. */
export const PAYMENT_METHODS = ['CASH', 'TRANSFER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

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
  /** Ya no se ofrece al registrar, pero los movimientos viejos siguen mostrando su nombre. */
  retired?: boolean
}

export interface Transaction {
  id: EntityId
  /** Preparado para cuentas múltiples. */
  accountId: EntityId
  type: TransactionType
  amount: MinorUnits
  description: string
  categoryId: EntityId
  country: Country
  currency: CurrencyCode
  holder: AccountHolder
  /** `null` en movimientos anteriores al flujo de registro completo. */
  paymentMethod: PaymentMethod | null
  /** Préstamo que originó el movimiento (salida al prestar; cobros de cuotas en el futuro). */
  loanId: EntityId | null
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

/** Estados de un préstamo. Hoy solo se crea `ACTIVE`; los demás quedan preparados. */
export const LOAN_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const
export type LoanStatus = (typeof LOAN_STATUSES)[number]

/** Estados de una cuota. Hoy solo se crea `PENDING`; `PAID` y `OVERDUE` quedan preparados. */
export const INSTALLMENT_STATUSES = ['PENDING', 'PAID', 'OVERDUE'] as const
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number]

export interface Loan {
  id: EntityId
  borrowerName: string
  /** Monto efectivamente prestado (lo único que sale de la cuenta). */
  principalAmount: MinorUnits
  /** Interés fijo, en porcentaje (70 = 70 %). */
  interestRate: number
  interestAmount: MinorUnits
  /** Monto prestado + interés (lo que se espera cobrar). */
  totalAmount: MinorUnits
  installmentCount: number
  /** Valor de la cuota (la mayor, si el total no divide exacto). */
  installmentAmount: MinorUnits
  loanDate: LocalDate
  dueDate: LocalDate
  status: LoanStatus
  currency: CurrencyCode
  /** Movimiento GASTO que registró la salida del dinero. */
  transactionId: EntityId
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface LoanInstallment {
  id: EntityId
  loanId: EntityId
  installmentNumber: number
  amount: MinorUnits
  dueDate: LocalDate
  status: InstallmentStatus
  paidAt: IsoTimestamp | null
  /** Movimiento INGRESO del cobro de la cuota (se completará al implementar los cobros). */
  paymentTransactionId: EntityId | null
}

/* ── Ahorros (frascos) ──────────────────────────────────────────────────── */

export const SAVINGS_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const
export type SavingsFrequency = (typeof SAVINGS_FREQUENCIES)[number]

/** Plan de ahorro de un frasco: cada cuánto y cuánto se quiere aportar. */
export interface SavingsPlan {
  frequency: SavingsFrequency
  /** Aporte por período. */
  amount: MinorUnits
}

/**
 * Frasco: una reserva interna de dinero para un objetivo. NO guarda el monto ahorrado: ese valor se
 * deriva de sus aportes, así no puede quedar desincronizado ni duplicarse.
 */
export interface SavingsJar {
  id: EntityId
  name: string
  targetAmount: MinorUnits
  /** Fecha objetivo opcional. */
  targetDate: LocalDate | null
  plan: SavingsPlan
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/**
 * Aporte a un frasco. Es una asignación interna: no es un movimiento (no es gasto ni ingreso) y no
 * cambia el saldo de la cuenta. Los aportes se conservan siempre (no se editan ni se eliminan).
 */
export interface SavingsContribution {
  id: EntityId
  jarId: EntityId
  amount: MinorUnits
  date: LocalDate
  createdAt: IsoTimestamp
}

/**
 * Saldo que la persona declara a mano en otra moneda (hoy, dólares). Es un dato propio: no es un
 * movimiento, no modifica el saldo en pesos y se guarda en la moneda original.
 */
export interface ManualBalance {
  id: EntityId
  currency: 'USD'
  amount: MinorUnits
  updatedAt: IsoTimestamp
}
