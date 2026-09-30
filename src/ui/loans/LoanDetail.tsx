import type { ReactNode } from 'react'
import {
  INSTALLMENT_STATUS_LABEL,
  LOAN_STATUS_LABEL,
  formatLoanDate,
  formatMoney,
  installmentPlanText,
  loanProgress,
  type InstallmentStatus,
  type Loan,
  type LoanInstallment,
} from '@/domain'
import { cx } from '../cx'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { FlowFrame } from '../flow/FlowFrame'

interface LoanDetailProps {
  loan: Loan
  installments: readonly LoanInstallment[]
  onOpenReceipt(): void
  onClose(): void
}

const INSTALLMENT_STYLE: Record<InstallmentStatus, { chip: string; dot: string }> = {
  PENDING: { chip: 'bg-warning-bg text-warning', dot: 'bg-warning' },
  PAID: { chip: 'bg-positive-bg text-positive', dot: 'bg-positive-vivid' },
  OVERDUE: { chip: 'bg-danger-bg text-danger', dot: 'bg-danger' },
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 py-1.5">
      <dt className="shrink-0 text-body text-fg-soft">{label}</dt>
      <dd className="type-subheading min-w-0 text-right text-fg">{children}</dd>
    </div>
  )
}

/** Detalle de un préstamo (solo lectura): datos, avance y cuotas una por una. */
export function LoanDetail({ loan, installments, onOpenReceipt, onClose }: LoanDetailProps) {
  const { paid, pending } = loanProgress(installments)
  const percent = loan.installmentCount === 0 ? 0 : Math.round((paid / loan.installmentCount) * 100)

  return (
    <FlowFrame className="animate-sheet">
      <div role="dialog" aria-modal="true" aria-label="Detalle del préstamo" className="flex min-h-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-gutter pt-safe pb-2">
          <div className="min-w-0">
            <h1 className="type-heading truncate">{loan.borrowerName}</h1>
            <p className="text-body-sm text-fg-soft">
              Préstamo del {formatLoanDate(loan.loanDate)} · {LOAN_STATUS_LABEL[loan.status]}
            </p>
          </div>
          <IconButton variant="secondary" size="md" onClick={onClose} aria-label="Cerrar detalle">
            <Icon name="close" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-4">
          <section className="mt-2 rounded-panel bg-panel p-5 text-on-panel">
            <p className="text-body-sm text-on-panel-soft">Total a devolver</p>
            <p className="type-money mt-1" data-testid="loan-total">
              {formatMoney(loan.totalAmount)}
            </p>
            <div
              role="progressbar"
              aria-label="Cuotas pagadas"
              aria-valuemin={0}
              aria-valuemax={loan.installmentCount}
              aria-valuenow={paid}
              className="mt-4 h-1.5 overflow-hidden rounded-pill bg-glass-on-panel"
            >
              <div className="h-full rounded-pill bg-positive-vivid" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-body-sm text-on-panel-soft">
              {paid} de {loan.installmentCount} cuotas pagadas
            </p>
          </section>

          <dl className="mt-3 py-2">
            <Row label="Prestatario">{loan.borrowerName}</Row>
            <Row label="Monto original">{formatMoney(loan.principalAmount)}</Row>
            <Row label="Interés">
              {loan.interestRate}% · {formatMoney(loan.interestAmount)}
            </Row>
            <Row label="Total a devolver">{formatMoney(loan.totalAmount)}</Row>
            <Row label="Cuotas">{installmentPlanText(loan.installmentCount, loan.installmentAmount)}</Row>
            <Row label="Cuotas pagadas">{paid}</Row>
            <Row label="Cuotas pendientes">{pending}</Row>
            <Row label="Fecha del préstamo">{formatLoanDate(loan.loanDate)}</Row>
            <Row label="Fecha límite de pago">{formatLoanDate(loan.dueDate)}</Row>
          </dl>

          <section aria-labelledby="installments-title" className="mt-4">
            <h2 id="installments-title" className="type-title mb-1">
              Cuotas
            </h2>
            <ul>
              {[...installments]
                .sort((a, b) => a.installmentNumber - b.installmentNumber)
                .map((installment) => {
                  const style = INSTALLMENT_STYLE[installment.status]
                  return (
                    <li
                      key={installment.id}
                      aria-label={`Cuota ${installment.installmentNumber} de ${loan.installmentCount}`}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-pill', style.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="type-subheading block text-fg">
                          Cuota {installment.installmentNumber} de {loan.installmentCount}
                        </span>
                        <span className="block text-body-sm text-fg-soft">Vence: {formatLoanDate(installment.dueDate)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="type-subheading block text-fg">{formatMoney(installment.amount)}</span>
                        <span
                          className={cx(
                            'mt-0.5 inline-block rounded-pill px-2 py-0.5 text-caption leading-tight font-medium',
                            style.chip,
                          )}
                        >
                          {INSTALLMENT_STATUS_LABEL[installment.status]}
                        </span>
                      </span>
                    </li>
                  )
                })}
            </ul>
          </section>
        </div>

        <div className="shrink-0 px-gutter pt-2 pb-safe">
          <Button block size="lg" variant="secondary" onClick={onOpenReceipt}>
            <Icon name="download" />
            Ver comprobante
          </Button>
        </div>
      </div>
    </FlowFrame>
  )
}
