import { formatDayMonthTitleCase } from './datetime'
import { formatMoney } from './money'
import type { InstallmentStatus, Loan, LoanStatus, LocalDate } from './models'

/** `2026-10-02` → `2 de Octubre de 2026` */
export function formatLoanDate(date: LocalDate): string {
  return `${formatDayMonthTitleCase(date)} de ${date.slice(0, 4)}`
}

/** `10 cuotas de $ 17.000,00` / `1 cuota de …` */
export function installmentPlanText(count: number, amountEach: number): string {
  return `${count} ${count === 1 ? 'cuota' : 'cuotas'} de ${formatMoney(amountEach)}`
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE: 'Activo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
}

export interface ReceiptRow {
  label: string
  value: string
}

/** Filas del comprobante, en el orden en que se muestran (la imagen y las pruebas usan esta misma lista). */
export function receiptRows(loan: Loan): ReceiptRow[] {
  return [
    { label: 'Prestatario', value: loan.borrowerName },
    { label: 'Monto prestado', value: formatMoney(loan.principalAmount) },
    { label: 'Interés', value: `${loan.interestRate}% · ${formatMoney(loan.interestAmount)}` },
    { label: 'Total a devolver', value: formatMoney(loan.totalAmount) },
    { label: 'Plan de pago', value: installmentPlanText(loan.installmentCount, loan.installmentAmount) },
    { label: 'Fecha del préstamo', value: formatLoanDate(loan.loanDate) },
    { label: 'Fecha límite de pago', value: formatLoanDate(loan.dueDate) },
  ]
}
