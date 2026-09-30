import {
  LOAN_STATUS_LABEL,
  formatDayMonthTitleCase,
  formatMoney,
  loanProgress,
  type Loan,
  type LoanInstallment,
} from '@/domain'
import { cx } from '../cx'
import { Icon } from '../components/Icon'

interface LoanCardProps {
  loan: Loan
  installments: readonly LoanInstallment[]
  onOpen(loan: Loan): void
}

/** Préstamo en "Mis préstamos": persona, montos, cuotas, próxima cuota y estado. */
export function LoanCard({ loan, installments, onOpen }: LoanCardProps) {
  const { next } = loanProgress(installments)
  const active = loan.status === 'ACTIVE'
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(loan)}
        aria-label={`Préstamo de ${loan.borrowerName}. Ver detalle`}
        className="interactive flex w-full flex-col gap-4 rounded-card bg-surface p-4 text-left shadow-card hover:bg-sunken active:bg-sunken-hover"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-avatar shrink-0 place-items-center rounded-pill bg-sunken text-fg">
            <Icon name="loan" />
          </span>
          <span className="type-subheading min-w-0 flex-1 truncate text-fg">{loan.borrowerName}</span>
          <span
            className={cx(
              'shrink-0 rounded-pill px-2.5 py-1 text-caption leading-none font-medium',
              active ? 'bg-positive-bg text-positive' : 'bg-sunken text-fg-soft',
            )}
          >
            {LOAN_STATUS_LABEL[loan.status]}
          </span>
        </span>

        <span className="grid grid-cols-2 gap-3">
          <span className="min-w-0">
            <span className="type-subheading block truncate text-fg">{formatMoney(loan.principalAmount)}</span>
            <span className="block text-body-sm text-fg-soft">prestados</span>
          </span>
          <span className="min-w-0">
            <span className="type-subheading block truncate text-fg">{formatMoney(loan.totalAmount)}</span>
            <span className="block text-body-sm text-fg-soft">a devolver</span>
          </span>
        </span>

        <span className="flex flex-col gap-0.5 border-t border-line pt-3 text-body-sm text-fg-soft">
          <span>
            {loan.installmentCount} {loan.installmentCount === 1 ? 'cuota' : 'cuotas'}
          </span>
          {next ? (
            <>
              <span className="text-fg">Próxima cuota: {formatMoney(next.amount)}</span>
              <span>Vence: {formatDayMonthTitleCase(next.dueDate)}</span>
            </>
          ) : (
            <span>Sin cuotas pendientes</span>
          )}
        </span>
      </button>
    </li>
  )
}
