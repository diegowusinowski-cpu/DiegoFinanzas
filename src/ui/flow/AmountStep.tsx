import { useState } from 'react'
import {
  appendAmountKey,
  formatAmountInput,
  formatMoney,
  parseAmountToMinor,
  type Category,
  type Country,
  type MinorUnits,
  type TransactionType,
} from '@/domain'
import { Flag } from '../components/Flags'
import { IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { LucaMascot, flowLuca } from '../luca'
import { Sheet } from '../components/Sheet'
import { AmountDisplay } from './AmountDisplay'
import { COUNTRY_INFO, HOLDER_LABEL, TYPE_LABEL } from './flowModel'
import { FlowHeader } from './FlowFrame'
import { NumericKeypad } from './NumericKeypad'

interface AmountStepProps {
  type: TransactionType
  country: Country
  category: Category | undefined
  amountRaw: string
  concept: string
  /** Saldo derivado en la moneda del país elegido. */
  balance: MinorUnits
  onChangeAmount(raw: string): void
  onChangeConcept(concept: string): void
  onChangeCountry(country: Country): void
  onBack(): void
  onContinue(): void
}

/** Pantalla de monto: calculadora financiera con teclado propio (sin input de formulario). */
export function AmountStep(props: AmountStepProps) {
  const { type, country, category, amountRaw, concept, balance } = props
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const { currency } = COUNTRY_INFO[country]
  const text = formatAmountInput(amountRaw)
  const minor = parseAmountToMinor(amountRaw)
  const canContinue = minor !== null && minor > 0
  const verb = type === 'INCOME' ? 'recibís' : 'pagás'

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

      <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
        {/* Acompaña sin tapar: en pantallas bajas no se muestra. */}
        <LucaMascot
          state={flowLuca(type)}
          size="sm"
          animation="enter"
          className="pointer-events-none absolute top-1 right-gutter [@media(max-height:700px)]:hidden"
        />
        <AmountDisplay text={text} currency={currency} empty={!canContinue && amountRaw.replace(/[0,]/g, '') === ''} />
        <p className="text-body text-fg-muted">
          Vos {verb} {text} {currency}
        </p>
      </section>

      <div className="flex shrink-0 flex-col gap-4 pb-3">
        <button
          type="button"
          onClick={() => setPickingCurrency(true)}
          aria-label={`Cambiar moneda. Actual: ${currency}`}
          className="interactive mx-auto inline-flex h-10 items-center gap-2 rounded-pill bg-sunken px-3.5 text-body-sm font-medium text-fg hover:bg-sunken-hover"
        >
          <Flag country={country} size={18} />
          <span>
            {currency} · {formatMoney(balance, currency)}
          </span>
          <Icon name="chevron-down" size="sm" className="text-fg-soft" />
        </button>

        <NumericKeypad onKey={(key) => props.onChangeAmount(appendAmountKey(amountRaw, key))} />
      </div>

      <form
        className="flex shrink-0 items-center gap-2 px-gutter pt-1 pb-safe"
        onSubmit={(event) => {
          event.preventDefault()
          if (canContinue) props.onContinue()
        }}
      >
        <input
          type="text"
          aria-label="Concepto"
          placeholder="Concepto (opcional)"
          autoComplete="off"
          maxLength={80}
          value={concept}
          onChange={(event) => props.onChangeConcept(event.target.value)}
          className="interactive h-control-lg min-w-0 flex-1 rounded-pill border border-transparent bg-sunken px-5 text-body text-fg outline-none focus:border-fg focus:bg-surface"
        />
        <IconButton
          type="submit"
          size="lg"
          variant="primary"
          aria-label="Continuar"
          disabled={!canContinue}
          className="disabled:bg-sunken disabled:text-fg-muted disabled:opacity-100"
        >
          <Icon name="arrow-right" />
        </IconButton>
      </form>

      <Sheet open={pickingCurrency} onClose={() => setPickingCurrency(false)} title="Moneda">
        <ul className="pb-2">
          {(Object.keys(COUNTRY_INFO) as Country[]).map((c) => (
            <OptionRow
              key={c}
              leading={<Flag country={c} size={36} />}
              title={COUNTRY_INFO[c].name}
              subtitle={COUNTRY_INFO[c].detail}
              onClick={() => {
                props.onChangeCountry(c)
                setPickingCurrency(false)
              }}
            />
          ))}
        </ul>
      </Sheet>
    </>
  )
}
