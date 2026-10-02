import { useEffect, useState, type ReactNode } from 'react'
import {
  INSTALLMENT_VIEW_LABEL,
  LOAN_VIEW_LABEL,
  formatLoanDate,
  formatMoney,
  installmentPlanText,
  installmentViews,
  loanProgress,
  loanView,
  toLocalDate,
  type Loan,
  type LoanInstallment,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { cx } from '../cx'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { FlowFrame } from '../flow/FlowFrame'
import { LucaMascot, loanLuca } from '../luca'
import { INSTALLMENT_VIEW_STYLE } from './loanStyles'

interface LoanDetailProps {
  loan: Loan
  installments: readonly LoanInstallment[]
  onOpenReceipt(): void
  onClose(): void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 py-1.5">
      <dt className="shrink-0 text-body text-fg-soft">{label}</dt>
      <dd className="type-subheading min-w-0 text-right text-fg">{children}</dd>
    </div>
  )
}

/** Detalle de un préstamo: datos, avance y cuotas una por una, con cobro de cada cuota. */
export function LoanDetail({ loan, installments, onOpenReceipt, onClose }: LoanDetailProps) {
  const { today, payInstallment } = useFinance()
  const toast = useToast()
  const { paid, pending } = loanProgress(installments)
  const view = loanView(loan, installments, today)
  const [collecting, setCollecting] = useState<LoanInstallment | null>(null)
  const [saving, setSaving] = useState(false)
  const [justPaid, setJustPaid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La carita feliz tras un cobro dura un momento y vuelve al estado del préstamo.
  useEffect(() => {
    if (!justPaid) return
    const timer = setTimeout(() => setJustPaid(false), 3000)
    return () => clearTimeout(timer)
  }, [justPaid])

  const closeSheet = () => {
    if (saving) return
    setCollecting(null)
    setError(null)
  }

  const confirmPayment = async () => {
    if (!collecting || saving) return
    setSaving(true)
    setError(null)
    const result = await payInstallment(collecting.id)
    setSaving(false)
    if (!result.ok) {
      setError(result.error.message ?? 'No se pudo registrar el cobro.')
      return
    }
    toast.show(`Cuota ${collecting.installmentNumber} cobrada`)
    setCollecting(null)
    setJustPaid(true)
  }
  const percent = loan.installmentCount === 0 ? 0 : Math.round((paid / loan.installmentCount) * 100)

  return (
    <>
    <FlowFrame className="animate-sheet">
      <div role="dialog" aria-modal="true" aria-label="Detalle del préstamo" className="flex min-h-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-gutter pt-safe pb-2">
          <div className="min-w-0">
            <h1 className="type-heading truncate">{loan.borrowerName}</h1>
            <p className="text-body-sm text-fg-soft">
              Préstamo del {formatLoanDate(loan.loanDate)} · {LOAN_VIEW_LABEL[view]}
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
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 id="installments-title" className="type-title">
                Cuotas
              </h2>
              {/* Pensativa con cuotas pendientes; contenta si el préstamo está completo o recién se cobró una cuota. */}
              <LucaMascot
                key={justPaid ? 'paid' : 'idle'}
                state={justPaid ? 'happy' : loanLuca(view)}
                size="sm"
                animation={justPaid ? 'celebrate' : 'enter'}
              />
            </div>
            <ul>
              {installmentViews(installments, today).map(({ installment, view: installmentView }) => {
                const style = INSTALLMENT_VIEW_STYLE[installmentView]
                return (
                  <li
                    key={installment.id}
                    aria-label={`Cuota ${installment.installmentNumber} de ${loan.installmentCount}`}
                    className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-pill', style.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="type-subheading block text-fg">
                          Cuota {installment.installmentNumber} de {loan.installmentCount}
                        </span>
                        <span className="block text-body-sm text-fg-soft">
                          {installment.paidAt
                            ? `Pagada el ${formatLoanDate(toLocalDate(new Date(installment.paidAt)))}`
                            : `Vence: ${formatLoanDate(installment.dueDate)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="type-subheading block text-fg">{formatMoney(installment.amount)}</span>
                        <span
                          className={cx(
                            'mt-0.5 rounded-pill px-2 py-0.5 text-caption leading-tight font-medium whitespace-nowrap',
                            style.chip,
                          )}
                        >
                          {INSTALLMENT_VIEW_LABEL[installmentView]}
                        </span>
                      </span>
                    </div>
                    {installmentView !== 'PAID' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="self-end"
                        aria-label={`Marcar cuota ${installment.installmentNumber} como pagada`}
                        onClick={() => setCollecting(installment)}
                      >
                        <Icon name="check" size="sm" />
                        Marcar como pagada
                      </Button>
                    ) : null}
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
    <Sheet open={collecting !== null} onClose={closeSheet} title="Cobrar cuota">
      {collecting ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-body text-fg-soft">
            Cuota {collecting.installmentNumber} de {loan.installmentCount} de {loan.borrowerName}
          </p>
          <p className="type-money" data-testid="collect-amount">
            {formatMoney(collecting.amount)}
          </p>
          <p className="text-body-sm text-fg-soft">
            Se va a registrar un ingreso por este importe y se suma a tu saldo.
          </p>
          {error ? (
            <p role="alert" className="rounded-control bg-danger-bg p-3 text-body-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button block size="lg" loading={saving} onClick={() => void confirmPayment()}>
              Confirmar cobro
            </Button>
            <Button block size="md" variant="tertiary" disabled={saving} onClick={closeSheet}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
    </>
  )
}
