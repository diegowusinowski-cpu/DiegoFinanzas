import { formatDayMonthTitleCase } from './datetime'
import { formatMoney } from './money'
import type { InstallmentView, LoanView } from './loans'
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

export const INSTALLMENT_VIEW_LABEL: Record<InstallmentView, string> = {
  PENDING: 'Pendiente',
  NEXT: 'Próxima',
  OVERDUE: 'Vencida',
  PAID: 'Pagada',
}

export const LOAN_VIEW_LABEL: Record<LoanView, string> = {
  PENDING: 'Pendiente',
  UPCOMING: 'Próximo',
  OVERDUE: 'Vencido',
  COMPLETED: 'Completado',
}

export interface ReceiptRow {
  label: string
  value: string
}

/** Filas del comprobante, en el orden en que se muestran (la imagen y las pruebas usan esta misma lista). */
export function receiptRows(loan: Loan, statusLabel: string): ReceiptRow[] {
  return [
    { label: 'Persona', value: loan.borrowerName },
    { label: 'Monto prestado', value: formatMoney(loan.principalAmount) },
    { label: `Interés ${loan.interestRate}%`, value: formatMoney(loan.interestAmount) },
    { label: 'Total a devolver', value: formatMoney(loan.totalAmount) },
    { label: 'Cantidad de cuotas', value: String(loan.installmentCount) },
    { label: 'Importe de cada cuota', value: formatMoney(loan.installmentAmount) },
    { label: 'Fecha del préstamo', value: formatLoanDate(loan.loanDate) },
    { label: 'Fecha límite', value: formatLoanDate(loan.dueDate) },
    { label: 'Estado', value: statusLabel },
  ]
}
