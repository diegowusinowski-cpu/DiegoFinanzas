import {
  LOAN_INTEREST_PERCENT,
  calculateLoan,
  formatAmountInput,
  formatLoanDate,
  formatMoney,
  installmentPlanText,
  type LocalDate,
} from '@/domain'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { AmountDisplay } from '../flow/AmountDisplay'
import { FlowHeader } from '../flow/FlowFrame'

interface SummaryStepProps {
  borrowerName: string
  principal: number
  amountRaw: string
  installmentCount: number
  loanDate: LocalDate
  dueDate: LocalDate
  saving: boolean
  error: string | null
  onBack(): void
  onCreate(): void
}

/** Resumen previo a crear el préstamo. */
export function SummaryStep(props: SummaryStepProps) {
  const calc = calculateLoan(props.principal, props.installmentCount)
  const rows: Array<[string, string]> = [
    ['Prestatario', props.borrowerName.trim()],
    [`Interés ${LOAN_INTEREST_PERCENT}%`, formatMoney(calc.interest)],
    ['Total a devolver', formatMoney(calc.total)],
    ['Plan de pago', installmentPlanText(props.installmentCount, calc.installmentAmount ?? 0)],
    ['Fecha del préstamo', formatLoanDate(props.loanDate)],
    ['Fecha límite de pago', formatLoanDate(props.dueDate)],
  ]

  return (
    <>
      <FlowHeader
        onBack={props.onBack}
        backLabel="Volver"
        title="Resumen del préstamo"
        heading
        subtitle="Revisá los datos antes de crear"
        trailing={
          <span className="grid size-control-md place-items-center rounded-pill bg-sunken text-fg">
            <Icon name="loan" />
          </span>
        }
      />

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-gutter text-center">
        <AmountDisplay text={formatAmountInput(props.amountRaw)} currency="ARS" />
        <p className="text-body text-fg-muted">Monto prestado</p>
      </section>

      <div className="shrink-0 px-gutter pb-safe">
        <dl className="mb-4 flex flex-col">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-12 items-center justify-between gap-4">
              <dt className="shrink-0 text-body text-fg-soft">{label}</dt>
              <dd className="type-subheading min-w-0 text-right text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        {props.error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger-bg p-3 text-body-sm text-danger">
            {props.error}
          </p>
        ) : null}
        <Button block size="lg" loading={props.saving} onClick={props.onCreate}>
          Crear préstamo
        </Button>
      </div>
    </>
  )
}
