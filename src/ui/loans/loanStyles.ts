import type { InstallmentView, LoanView } from '@/domain'

/** Colores de los estados de préstamo y cuota (mismos tokens semánticos que el resto de la app). */
export const LOAN_VIEW_STYLE: Record<LoanView, string> = {
  PENDING: 'bg-sunken text-fg-soft',
  UPCOMING: 'bg-warning-bg text-warning',
  OVERDUE: 'bg-danger-bg text-danger',
  COMPLETED: 'bg-positive-bg text-positive',
}

export const INSTALLMENT_VIEW_STYLE: Record<InstallmentView, { chip: string; dot: string }> = {
  PENDING: { chip: 'bg-sunken text-fg-soft', dot: 'bg-fg-muted' },
  NEXT: { chip: 'bg-warning-bg text-warning', dot: 'bg-warning' },
  OVERDUE: { chip: 'bg-danger-bg text-danger', dot: 'bg-danger' },
  PAID: { chip: 'bg-positive-bg text-positive', dot: 'bg-positive-vivid' },
}
