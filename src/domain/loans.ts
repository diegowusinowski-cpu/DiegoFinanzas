import { addDays, diffInDays, isValidLocalDate, toLocalDate, toLocalTime } from './datetime'
import { MAX_MINOR_UNITS } from './money'
import type {
  EntityId,
  Loan,
  LoanInstallment,
  LocalDate,
  MinorUnits,
  Transaction,
} from './models'
import { MAX_DESCRIPTION_LENGTH, buildTransaction, type Result } from './transactions'

/** Tasa fija de esta primera versión. */
export const LOAN_INTEREST_PERCENT = 70
/** Cuotas ofrecidas como atajo; el sistema acepta cualquier cantidad hasta `MAX_INSTALLMENTS`. */
export const LOAN_INSTALLMENT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12] as const
export const MAX_INSTALLMENTS = 360
export const MAX_BORROWER_NAME_LENGTH = 60
/** Categoría de gasto con la que se registra la salida del préstamo. */
export const LOAN_EXPENSE_CATEGORY_ID = 'exp-loans'
/** Categoría de ingreso con la que se registra el cobro de una cuota. */
export const LOAN_INCOME_CATEGORY_ID = 'inc-loans'

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

/** Estado que se muestra de una cuota (se deriva del estado guardado y de la fecha de hoy). */
export type InstallmentView = 'PENDING' | 'NEXT' | 'OVERDUE' | 'PAID'
/** Estado que se muestra de un préstamo. */
export type LoanView = 'PENDING' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'

/** Una cuota sin pagar es "próxima" si vence dentro de esta cantidad de días (o menos). */
export const UPCOMING_DAYS = 7

export interface InstallmentWithView {
  installment: LoanInstallment
  view: InstallmentView
}

/**
 * Estado visible de cada cuota: Pagada; Vencida si su fecha ya pasó sin pagar; Próxima la primera
 * cuota sin pagar que todavía no venció; Pendiente el resto.
 */
export function installmentViews(installments: readonly LoanInstallment[], today: LocalDate): InstallmentWithView[] {
  const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber)
  let nextAssigned = false
  return sorted.map((installment) => {
    if (installment.status === 'PAID') return { installment, view: 'PAID' }
    if (installment.dueDate < today) return { installment, view: 'OVERDUE' }
    if (!nextAssigned) {
      nextAssigned = true
      return { installment, view: 'NEXT' }
    }
    return { installment, view: 'PENDING' }
  })
}

/**
 * Estado visible del préstamo: Completado si no quedan cuotas; Vencido si alguna cuota pasó su fecha
 * sin pagarse; Próximo si la próxima cuota vence en `UPCOMING_DAYS` días o menos; Pendiente en otro caso.
 */
export function loanView(loan: Loan, installments: readonly LoanInstallment[], today: LocalDate): LoanView {
  if (loan.status !== 'ACTIVE') return 'COMPLETED'
  const views = installmentViews(installments, today)
  if (views.length > 0 && views.every((v) => v.view === 'PAID')) return 'COMPLETED'
  if (views.some((v) => v.view === 'OVERDUE')) return 'OVERDUE'
  const next = views.find((v) => v.view === 'NEXT')
  if (next && diffInDays(today, next.installment.dueDate) <= UPCOMING_DAYS) return 'UPCOMING'
  return 'PENDING'
}

export interface LoansSummary {
  /** Suma de los montos realmente prestados (sin interés). */
  totalLent: MinorUnits
  /** Suma de las cuotas ya cobradas. */
  totalCollected: MinorUnits
  /** Suma de las cuotas todavía sin cobrar. */
  totalPending: MinorUnits
  overdueCount: number
}

export function loansSummary(
  loans: readonly Loan[],
  installments: readonly LoanInstallment[],
  today: LocalDate,
): LoansSummary {
  const summary: LoansSummary = { totalLent: 0, totalCollected: 0, totalPending: 0, overdueCount: 0 }
  for (const loan of loans) {
    summary.totalLent += loan.principalAmount
    const own = installmentsOf(loan.id, installments)
    for (const i of own) {
      if (i.status === 'PAID') summary.totalCollected += i.amount
      else summary.totalPending += i.amount
    }
    if (loanView(loan, own, today) === 'OVERDUE') summary.overdueCount += 1
  }
  return summary
}

export interface InstallmentPayment {
  loan: Loan
  installment: LoanInstallment
  /** Ingreso por el importe de la cuota: aumenta el saldo. */
  transaction: Transaction
}

export type PayInstallmentError = 'NOT_FOUND' | 'ALREADY_PAID'

/**
 * Arma, sin persistir, el cobro de una cuota: la cuota pasa a PAGADA, se crea el INGRESO por su
 * importe y el préstamo se completa si era la última cuota pendiente.
 */
export function buildInstallmentPayment(
  loan: Loan,
  installment: LoanInstallment,
  loanInstallments: readonly LoanInstallment[],
  meta: { now: Date; newId: () => EntityId; accountId: EntityId },
): Result<InstallmentPayment, PayInstallmentError> {
  if (installment.loanId !== loan.id) return { ok: false, error: 'NOT_FOUND' }
  if (installment.status === 'PAID') return { ok: false, error: 'ALREADY_PAID' }
  const { now, newId, accountId } = meta
  const timestamp = now.toISOString()
  const label = `Cobro cuota ${installment.installmentNumber}/${loan.installmentCount} - `
  const name = loan.borrowerName.slice(0, Math.max(0, MAX_DESCRIPTION_LENGTH - label.length))

  const transaction: Transaction = {
    ...buildTransaction(
      {
        accountId,
        type: 'INCOME',
        amount: installment.amount,
        description: `${label}${name}`,
        categoryId: LOAN_INCOME_CATEGORY_ID,
        date: toLocalDate(now),
        time: toLocalTime(now),
        country: 'AR',
        currency: 'ARS',
        holder: 'INDIVIDUAL',
        paymentMethod: null,
        loanId: loan.id,
      },
      { id: newId(), now },
    ),
    status: 'COMPLETED',
  }

  const paid: LoanInstallment = { ...installment, status: 'PAID', paidAt: timestamp, paymentTransactionId: transaction.id }
  const allPaid = loanInstallments.every((i) => (i.id === installment.id ? true : i.status === 'PAID'))
  const updatedLoan: Loan = { ...loan, status: allPaid ? 'COMPLETED' : loan.status, updatedAt: timestamp }
  return { ok: true, value: { loan: updatedLoan, installment: paid, transaction } }
}

/** Más recientes primero. */
export function sortLoans(loans: readonly Loan[]): Loan[] {
  return [...loans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
