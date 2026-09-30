import { useId } from 'react'
import {
  PAYMENT_METHODS,
  formatAmountInput,
  type Category,
  type Country,
  type LocalDate,
  type PaymentMethod,
  type TransactionType,
} from '@/domain'
import { cx } from '../cx'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { AmountDisplay } from './AmountDisplay'
import { COUNTRY_INFO, HOLDER_LABEL, PAYMENT_LABEL, TYPE_LABEL, formatLongDate } from './flowModel'
import { FlowHeader } from './FlowFrame'

interface ConfirmStepProps {
  type: TransactionType
  country: Country
  category: Category | undefined
  amountRaw: string
  paymentMethod: PaymentMethod
  date: LocalDate
  saving: boolean
  error: string | null
  onChangeMethod(method: PaymentMethod): void
  onChangeDate(date: LocalDate): void
  onBack(): void
  onConfirm(): void
}

/** Pantalla de confirmación: monto, resumen editable (tipo y fecha) y botón final. */
export function ConfirmStep(props: ConfirmStepProps) {
  const { type, country, category, paymentMethod, date } = props
  const { currency } = COUNTRY_INFO[country]
  const text = formatAmountInput(props.amountRaw)
  const verb = type === 'INCOME' ? 'recibís' : 'pagás'
  const methodLabelId = useId()
  const rowClass = 'flex min-h-12 items-center justify-between gap-4'

  return (
    <>
      <FlowHeader
        onBack={props.onBack}
        backLabel="Volver"
        title={category?.name ?? TYPE_LABEL[type].noun}
        subtitle={`${TYPE_LABEL[type].noun} · ${COUNTRY_INFO[country].name} · ${HOLDER_LABEL.INDIVIDUAL}`}
        trailing={
          <span className="grid size-control-md place-items-center rounded-pill bg-sunken text-fg">
            <Icon name={type === 'INCOME' ? 'arrow-down' : 'arrow-up'} />
          </span>
        }
      />

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
        <AmountDisplay text={text} currency={currency} />
        <p className="text-body text-fg-muted">
          Vos {verb} {text} {currency}
        </p>
      </section>

      <div className="shrink-0 px-gutter pb-safe">
        <dl className="mb-4 flex flex-col">
          <div className={rowClass}>
            <dt className="text-body text-fg-soft">{TYPE_LABEL[type].confirmRow}</dt>
            <dd className="type-subheading min-w-0 text-right text-fg">{category?.name}</dd>
          </div>

          <div className={rowClass}>
            <dt id={methodLabelId} className="text-body text-fg-soft">
              Tipo
            </dt>
            <dd>
              <div role="radiogroup" aria-labelledby={methodLabelId} className="flex gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const selected = method === paymentMethod
                  return (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => props.onChangeMethod(method)}
                      className={cx(
                        'interactive h-9 rounded-pill px-3.5 text-body-sm font-medium',
                        selected ? 'bg-action text-on-action' : 'bg-sunken text-fg-soft hover:bg-sunken-hover',
                      )}
                    >
                      {PAYMENT_LABEL[method]}
                    </button>
                  )
                })}
              </div>
            </dd>
          </div>

          <div className={rowClass}>
            <dt className="text-body text-fg-soft">Fecha</dt>
            <dd>
              <label className="relative inline-flex min-h-9 cursor-pointer items-center gap-1.5">
                <span className="type-subheading text-fg">{formatLongDate(date)}</span>
                <Icon name="chevron-down" size="sm" className="text-fg-soft" />
                <input
                  type="date"
                  aria-label="Fecha"
                  value={date}
                  onChange={(event) => {
                    if (event.target.value) props.onChangeDate(event.target.value)
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </dd>
          </div>
        </dl>

        {props.error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger-bg p-3 text-body-sm text-danger">
            {props.error}
          </p>
        ) : null}

        <Button block size="lg" loading={props.saving} onClick={props.onConfirm}>
          {TYPE_LABEL[type].confirmCta}
        </Button>
      </div>
    </>
  )
}
