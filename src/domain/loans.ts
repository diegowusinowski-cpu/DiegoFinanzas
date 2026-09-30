import { addDays, diffInDays, isValidLocalDate, toLocalTime } from './datetime'
import { MAX_MINOR_UNITS } from './money'
import type {
  EntityId,
  Loan,
  LoanInstallment,
  LocalDate,
  MinorUnits,
  Transaction,
} from './models'
import { buildTransaction } from './transactions'

/** Tasa fija de esta primera versión. */
export const LOAN_INTEREST_PERCENT = 70
/** Cuotas ofrecidas como atajo; el sistema acepta cualquier cantidad hasta `MAX_INSTALLMENTS`. */
export const LOAN_INSTALLMENT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12] as const
export const MAX_INSTALLMENTS = 360
export const MAX_BORROWER_NAME_LENGTH = 60
/** Categoría de gasto con la que se registra la salida del préstamo. */
export const LOAN_EXPENSE_CATEGORY_ID = 'exp-loans'

/** Interés = monto × 70 %, en centavos enteros. */
export function interestFor(principal: MinorUnits): MinorUnits {
  return Math.round((principal * LOAN_INTEREST_PERCENT) / 100)
}

/** Total a devolver = monto × 1,70. */
export function totalWithInterest(principal: MinorUnits): MinorUnits {
  return principal + interestFor(principal)
}

/**
 * Reparte `total` en `count` cuotas sin perder centavos: las primeras cuotas
 * llevan el centavo sobrante, de modo que la suma es exactamente el total.
 */
export function splitInstallments(total: MinorUnits, count: number): MinorUnits[] {
  if (!Number.isInteger(count) || count < 1) return []
  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

export interface LoanCalculation {
  principal: MinorUnits
  interestPercent: number
  interest: MinorUnits
  total: MinorUnits
  installmentCount: number | null
  /** Importe de cada cuota (vacío si todavía no se eligió cantidad). */
  installments: MinorUnits[]
  /** Valor de la cuota (la mayor). `null` si no hay cantidad de cuotas. */
  installmentAmount: MinorUnits | null
}

/** Calculadora: monto → interés 70 % → total → cuotas. No crea nada. */
export function calculateLoan(principal: MinorUnits, installmentCount: number | null = null): LoanCalculation {
  const interest = interestFor(principal)
  const total = principal + interest
  const installments = installmentCount === null ? [] : splitInstallments(total, installmentCount)
  return {
    principal,
    interestPercent: LOAN_INTEREST_PERCENT,
    interest,
    total,
    installmentCount,
    installments,
    installmentAmount: installments[0] ?? null,
  }
}

/**
 * Vencimientos repartidos de forma pareja entre la fecha del préstamo y la
 * fecha límite; la última cuota vence exactamente en la fecha límite.
 */
export function installmentDueDates(loanDate: LocalDate, dueDate: LocalDate, count: number): LocalDate[] {
  const days = diffInDays(loanDate, dueDate)
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? dueDate : addDays(loanDate, Math.round(((i + 1) * days) / count)),
  )
}

export interface NewLoanInput {
  accountId: EntityId
  borrowerName: string
  principalAmount: MinorUnits
  installmentCount: number
  loanDate: LocalDate
  dueDate: LocalDate
}

export type LoanField = 'borrowerName' | 'principalAmount' | 'installmentCount' | 'loanDate' | 'dueDate'
export type LoanErrors = Partial<Record<LoanField, string>>

export function validateNewLoan(input: NewLoanInput): LoanErrors {
  const errors: LoanErrors = {}
  const name = input.borrowerName.trim()
  if (name === '') errors.borrowerName = 'Ingresá el nombre de quien solicita el préstamo.'
  else if (name.length > MAX_BORROWER_NAME_LENGTH) {
    errors.borrowerName = `Máximo ${MAX_BORROWER_NAME_LENGTH} caracteres.`
  }

  if (!Number.isSafeInteger(input.principalAmount) || input.principalAmount <= 0) {
    errors.principalAmount = 'Ingresá un monto mayor a cero.'
  } else if (totalWithInterest(input.principalAmount) > MAX_MINOR_UNITS) {
    errors.principalAmount = 'El monto es demasiado grande.'
  }

  if (
    !Number.isInteger(input.installmentCount) ||
    input.installmentCount < 1 ||
    input.installmentCount > MAX_INSTALLMENTS
  ) {
    errors.installmentCount = `Elegí entre 1 y ${MAX_INSTALLMENTS} cuotas.`
  }

  if (!isValidLocalDate(input.loanDate)) errors.loanDate = 'Fecha inválida.'
  if (!isValidLocalDate(input.dueDate)) errors.dueDate = 'Fecha inválida.'
  else if (!errors.loanDate && input.dueDate <= input.loanDate) {
    errors.dueDate = 'La fecha límite debe ser posterior a la fecha del préstamo.'
  }
  return errors
}

export interface LoanBundle {
  loan: Loan
  installments: LoanInstallment[]
  /** Salida (GASTO) por el monto realmente prestado. El interés NO es un movimiento. */
  transaction: Transaction
}

/**
 * Arma, sin persistir, el préstamo completo: el préstamo, sus cuotas
 * (PENDIENTE) y el movimiento GASTO "Préstamo a [nombre]" por el monto prestado.
 */
export function buildLoanBundle(input: NewLoanInput, meta: { now: Date; newId: () => EntityId }): LoanBundle {
  const { now, newId } = meta
  const calc = calculateLoan(input.principalAmount, input.installmentCount)
  const name = input.borrowerName.trim()
  const timestamp = now.toISOString()
  const loanId = newId()

  // La salida ocurre al crear el préstamo: se registra como COMPLETED (descuenta del saldo) aunque la
  // fecha del préstamo sea posterior; `date` conserva la fecha elegida.
  const transaction: Transaction = {
    ...buildTransaction(
    {
      accountId: input.accountId,
      type: 'EXPENSE',
      amount: input.principalAmount,
      description: `Préstamo a ${name}`,
      categoryId: LOAN_EXPENSE_CATEGORY_ID,
      date: input.loanDate,
      time: toLocalTime(now),
      country: 'AR',
      currency: 'ARS',
      holder: 'INDIVIDUAL',
      paymentMethod: null,
      loanId,
    },
    { id: newId(), now },
    ),
    status: 'COMPLETED',
  }

  const loan: Loan = {
    id: loanId,
    borrowerName: name,
    principalAmount: input.principalAmount,
    interestRate: LOAN_INTEREST_PERCENT,
    interestAmount: calc.interest,
    totalAmount: calc.total,
    installmentCount: input.installmentCount,
    installmentAmount: calc.installmentAmount ?? 0,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    status: 'ACTIVE',
    currency: 'ARS',
    transactionId: transaction.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const dates = installmentDueDates(input.loanDate, input.dueDate, input.installmentCount)
  const installments: LoanInstallment[] = calc.installments.map((amount, i) => ({
    id: newId(),
    loanId,
    installmentNumber: i + 1,
    amount,
    dueDate: dates[i] ?? input.dueDate,
    status: 'PENDING',
    paidAt: null,
    paymentTransactionId: null,
  }))

  return { loan, installments, transaction }
}

export function installmentsOf(loanId: EntityId, all: readonly LoanInstallment[]): LoanInstallment[] {
  return all.filter((i) => i.loanId === loanId).sort((a, b) => a.installmentNumber - b.installmentNumber)
}

export interface LoanProgress {
  paid: number
  pending: number
  /** Próxima cuota por cobrar (la de menor número pendiente). */
  next: LoanInstallment | null
}

export function loanProgress(installments: readonly LoanInstallment[]): LoanProgress {
  const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber)
  return {
    paid: sorted.filter((i) => i.status === 'PAID').length,
    pending: sorted.filter((i) => i.status !== 'PAID').length,
    next: sorted.find((i) => i.status !== 'PAID') ?? null,
  }
}

/** Más recientes primero. */
export function sortLoans(loans: readonly Loan[]): Loan[] {
  return [...loans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
