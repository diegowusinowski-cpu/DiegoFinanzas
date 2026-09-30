import {
  LOAN_VIEW_LABEL,
  formatDayMonthTitleCase,
  formatMoney,
  installmentViews,
  loanProgress,
  loanView,
  type Loan,
  type LoanInstallment,
  type LocalDate,
} from '@/domain'
import { cx } from '../cx'
import { Icon } from '../components/Icon'
import { LOAN_VIEW_STYLE } from './loanStyles'

interface LoanRowProps {
  loan: Loan
  installments: readonly LoanInstallment[]
  today: LocalDate
  onOpen(loan: Loan): void
}

/** Fila del listado de préstamos: persona, montos, avance de cuotas, próxima cuota, vencimiento y estado. */
export function LoanRow({ loan, installments, today, onOpen }: LoanRowProps) {
  const { paid } = loanProgress(installments)
  const view = loanView(loan, installments, today)
  const nextView = installmentViews(installments, today).find((v) => v.view !== 'PAID')
  const next = nextView?.installment ?? null
  const percent = loan.installmentCount === 0 ? 0 : Math.round((paid / loan.installmentCount) * 100)
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(loan)}
        aria-label={`Préstamo de ${loan.borrowerName}. Ver detalle`}
        className="interactive -mx-2 flex w-[calc(100%+1rem)] flex-col gap-3 rounded-card px-2 py-4 text-left hover:bg-glass active:bg-glass-strong"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-avatar shrink-0 place-items-center rounded-pill bg-sunken text-fg">
            <Icon name="loan" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-subheading block truncate text-fg">{loan.borrowerName}</span>
            <span className="block truncate text-body-sm text-fg-soft">
              Original {formatMoney(loan.principalAmount)}
            </span>
          </span>
          <span
            className={cx(
              'shrink-0 rounded-pill px-2.5 py-1 text-caption leading-none font-medium',
              LOAN_VIEW_STYLE[view],
            )}
          >
            {LOAN_VIEW_LABEL[view]}
          </span>
        </span>

        <span className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm text-fg-soft">A devolver</span>
          <span className="type-subheading min-w-0 truncate text-fg">{formatMoney(loan.totalAmount)}</span>
        </span>

        <span className="flex flex-col gap-1.5">
          <span
            role="progressbar"
            aria-label={`Cuotas pagadas de ${loan.borrowerName}`}
            aria-valuemin={0}
            aria-valuemax={loan.installmentCount}
            aria-valuenow={paid}
            className="block h-1.5 overflow-hidden rounded-pill bg-sunken"
          >
            <span className="block h-full rounded-pill bg-positive-vivid" style={{ width: `${percent}%` }} />
          </span>
          <span className="text-body-sm text-fg-soft">
            {paid} de {loan.installmentCount} {loan.installmentCount === 1 ? 'cuota' : 'cuotas'} pagadas
          </span>
        </span>

        <span className="flex flex-col gap-0.5 text-body-sm text-fg-soft">
          {next ? (
            <span>
              {nextView?.view === 'OVERDUE' ? 'Cuota vencida' : 'Próxima cuota'}: <span className="text-fg">{formatMoney(next.amount)}</span> · {formatDayMonthTitleCase(next.dueDate)}
            </span>
          ) : (
            <span>Todas las cuotas cobradas</span>
          )}
          <span>Vence: {formatDayMonthTitleCase(loan.dueDate)} de {loan.dueDate.slice(0, 4)}</span>
        </span>
      </button>
    </li>
  )
}
