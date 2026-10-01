import type {
  Account,
  Category,
  InstallmentPayment,
  Loan,
  LoanBundle,
  LoanInstallment,
  Reminder,
  SavingsContribution,
  SavingsJar,
  Transaction,
} from '@/domain'

/**
 * Contratos de persistencia. Son asíncronos a propósito: hoy los respalda
 * localStorage, mañana pueden respaldarlos una base de datos remota sin tocar
 * la UI ni la lógica financiera.
 *
 * Deliberadamente NO existe `delete`: los movimientos (y recordatorios) se
 * cancelan/descartan cambiando su estado, nunca se eliminan físicamente.
 */
export interface TransactionRepository {
  list(): Promise<Transaction[]>
  add(transaction: Transaction): Promise<void>
  update(transactions: readonly Transaction[]): Promise<void>
}

export interface AccountRepository {
  list(): Promise<Account[]>
  /** Devuelve la(s) cuenta(s); crea la cuenta principal si no hay ninguna. */
  ensureDefault(now: Date): Promise<Account[]>
}

export interface CategoryRepository {
  list(): Promise<Category[]>
}

export interface ReminderRepository {
  list(): Promise<Reminder[]>
  add(reminder: Reminder): Promise<void>
  update(reminder: Reminder): Promise<void>
}

/**
 * Préstamos y sus cuotas. Como un préstamo también genera un movimiento GASTO,
 * `create` guarda préstamo + cuotas + movimiento de forma atómica (todo o nada).
 * No hay `delete`: los préstamos y cuotas se conservan siempre.
 */
export interface LoanRepository {
  listLoans(): Promise<Loan[]>
  listInstallments(): Promise<LoanInstallment[]>
  create(bundle: LoanBundle): Promise<void>
  /** Cobra una cuota: actualiza cuota + préstamo y registra el ingreso, todo o nada. */
  recordPayment(payment: InstallmentPayment): Promise<void>
}

/**
 * Frascos de ahorro y sus aportes. Los aportes solo se agregan: no hay `update` ni `delete`, y no
 * tocan los movimientos (ahorrar es una reserva interna, no un gasto).
 */
export interface SavingsRepository {
  listJars(): Promise<SavingsJar[]>
  listContributions(): Promise<SavingsContribution[]>
  createJar(jar: SavingsJar): Promise<void>
  addContribution(contribution: SavingsContribution): Promise<void>
}

export interface Repositories {
  transactions: TransactionRepository
  accounts: AccountRepository
  categories: CategoryRepository
  reminders: ReminderRepository
  loans: LoanRepository
  savings: SavingsRepository
}
