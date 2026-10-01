import { useState, type ReactNode } from 'react'
import {
  LOAN_INSTALLMENT_PRESETS,
  LOAN_INTEREST_PERCENT,
  MAX_INSTALLMENTS,
  addDays,
  appendAmountKey,
  calculateLoan,
  formatAmountInput,
  formatLoanDate,
  formatMoney,
  installmentPlanText,
  parseAmountToMinor,
  type LocalDate,
} from '@/domain'
import { cx } from '../cx'
import { Button } from '../components/Button'
import { Field, inputClass } from '../components/Field'
import { Icon } from '../components/Icon'
import { AmountDisplay } from '../flow/AmountDisplay'
import { FlowHeader } from '../flow/FlowFrame'
import { NumericKeypad } from '../flow/NumericKeypad'

/** Fila "rótulo — valor" del resumen de montos. */
export function SummaryLine({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-body text-fg-soft">{label}</dt>
      <dd className={cx('min-w-0 text-right', strong ? 'type-title text-fg' : 'type-subheading text-fg')}>{value}</dd>
    </div>
  )
}

export function DecorativeIcon({ name }: { name: 'loan' | 'jar' | 'calculator' | 'calendar' | 'user' }) {
  return (
    <span className="grid size-control-md place-items-center rounded-pill bg-sunken text-fg">
      <Icon name={name} />
    </span>
  )
}

export const BOTTOM_BAR = 'shrink-0 px-gutter pt-2 pb-safe'

/* ── Paso 1: monto a prestar, con teclado y cálculo en vivo ─────────────── */

interface LoanAmountStepProps {
  amountRaw: string
  onChangeAmount(raw: string): void
  onBack(): void
  onContinue(): void
}

export function LoanAmountStep({ amountRaw, onChangeAmount, onBack, onContinue }: LoanAmountStepProps) {
  const minor = parseAmountToMinor(amountRaw)
  const valid = minor !== null && minor > 0
  const calc = calculateLoan(minor ?? 0)

  return (
    <>
      <FlowHeader
        onBack={onBack}
        backLabel="Volver"
        title="Monto a prestar"
        heading
        subtitle={`Nuevo préstamo · Interés ${LOAN_INTEREST_PERCENT}%`}
        trailing={<DecorativeIcon name="loan" />}
      />

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-gutter text-center">
        <div className="flex flex-col items-center gap-2">
          <AmountDisplay text={formatAmountInput(amountRaw)} currency="ARS" empty={!valid} />
          <p className="text-body text-fg-muted">Escribí el monto a prestar</p>
        </div>
        <dl className="flex w-full flex-col gap-2" aria-label="Cálculo del préstamo">
          <SummaryLine label="Monto prestado" value={formatMoney(calc.principal)} />
          <SummaryLine label={`Interés ${LOAN_INTEREST_PERCENT}%`} value={formatMoney(calc.interest)} />
          <SummaryLine label="Total a devolver" value={formatMoney(calc.total)} strong />
        </dl>
      </section>

      <div className="shrink-0 pb-2">
        <NumericKeypad onKey={(key) => onChangeAmount(appendAmountKey(amountRaw, key))} />
      </div>
      <div className={BOTTOM_BAR}>
        <Button block size="lg" disabled={!valid} onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  )
}

/* ── Paso 2: cantidad de cuotas ─────────────────────────────────────────── */

interface InstallmentsStepProps {
  /** Monto prestado en centavos. */
  principal: number
  count: number | null
  onChangeCount(count: number | null): void
  onBack(): void
  onContinue(): void
}

export function InstallmentsStep({
  principal,
  count,
  onChangeCount,
  onBack,
  onContinue,
}: InstallmentsStepProps) {
  const [custom, setCustom] = useState('')
  const calc = calculateLoan(principal, count)
  const isPreset = count !== null && (LOAN_INSTALLMENT_PRESETS as readonly number[]).includes(count)

  const pickPreset = (n: number) => {
    setCustom('')
    onChangeCount(n)
  }
  const changeCustom = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 3)
    setCustom(digits)
    const n = Number(digits)
    onChangeCount(digits !== '' && n >= 1 && n <= MAX_INSTALLMENTS ? n : null)
  }

  return (
    <>
      <FlowHeader
        onBack={onBack}
        backLabel="Volver"
        title="Cuotas"
        subtitle={`Total a devolver ${formatMoney(calc.total)}`}
        trailing={<DecorativeIcon name="loan" />}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-4">
        <h1 className="type-display">¿En cuántas cuotas?</h1>

        <div role="radiogroup" aria-label="Cantidad de cuotas" className="mt-6 grid grid-cols-4 gap-2.5">
          {LOAN_INSTALLMENT_PRESETS.map((n) => {
            const selected = count === n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${n} ${n === 1 ? 'cuota' : 'cuotas'}`}
                onClick={() => pickPreset(n)}
                className={cx(
                  'interactive grid h-14 place-items-center rounded-card text-[1.25rem] font-medium',
                  selected ? 'bg-action text-on-action' : 'bg-sunken text-fg hover:bg-sunken-hover',
                )}
              >
                {n}
              </button>
            )
          })}
        </div>

        <div className="mt-5">
          <Field label="Otra cantidad" hint={`Hasta ${MAX_INSTALLMENTS} cuotas`}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej.: 15"
              value={custom}
              onChange={(event) => changeCustom(event.target.value)}
              className={cx(inputClass, !isPreset && count !== null && 'border-fg bg-surface')}
            />
          </Field>
        </div>

        <section
          aria-live="polite"
          aria-label="Resultado"
          className="mt-6 rounded-card bg-sunken p-5 text-center"
        >
          {count !== null && calc.installmentAmount !== null ? (
            <>
              <p className="type-heading">{installmentPlanText(count, calc.installmentAmount)}</p>
              <p className="mt-1 text-body-sm text-fg-soft">
                {formatMoney(calc.total)} ÷ {count} {count === 1 ? 'cuota' : 'cuotas'}
              </p>
            </>
          ) : (
            <p className="text-body text-fg-soft">Elegí la cantidad de cuotas para ver el valor de cada una.</p>
          )}
        </section>
      </main>

      <div className={BOTTOM_BAR}>
        <Button block size="lg" disabled={count === null} onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  )
}

/* ── Fechas ─────────────────────────────────────────────────────────────── */

interface DateStepProps {
  title: string
  label: string
  value: LocalDate
  min?: LocalDate
  onChange(date: LocalDate): void
  onBack(): void
  onContinue(): void
}

/** Pregunta con fecha exacta: el campo nativo queda invisible sobre un control grande. */
export function DateStep({ title, label, value, min, onChange, onBack, onContinue }: DateStepProps) {
  return (
    <>
      <FlowHeader onBack={onBack} backLabel="Volver" title="Nuevo préstamo" trailing={<DecorativeIcon name="calendar" />} />
      <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-4">
        <h1 className="type-display">{title}</h1>
        <label className="relative mt-8 flex cursor-pointer items-center justify-between gap-4 rounded-card bg-sunken p-5">
          <span className="min-w-0">
            <span className="block text-body-sm text-fg-soft">{label}</span>
            <span className="type-heading mt-1 block text-fg">{formatLoanDate(value)}</span>
          </span>
          <Icon name="calendar" size="lg" className="text-fg-soft" />
          <input
            type="date"
            aria-label={label}
            value={value}
            {...(min ? { min } : {})}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value)
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </main>
      <div className={BOTTOM_BAR}>
        <Button block size="lg" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  )
}

export const nextDay = (date: LocalDate) => addDays(date, 1)

/* ── Persona ────────────────────────────────────────────────────────────── */

interface BorrowerStepProps {
  value: string
  onChange(name: string): void
  onBack(): void
  onContinue(): void
}

export function BorrowerStep({ value, onChange, onBack, onContinue }: BorrowerStepProps) {
  const [touched, setTouched] = useState(false)
  const empty = value.trim() === ''
  return (
    <>
      <FlowHeader onBack={onBack} backLabel="Volver" title="Nuevo préstamo" trailing={<DecorativeIcon name="user" />} />
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (empty) setTouched(true)
          else onContinue()
        }}
      >
        <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-4">
          <h1 className="type-display">¿Quién solicita el préstamo?</h1>
          <div className="mt-8">
            <Field label="Nombre" error={touched && empty ? 'Ingresá el nombre de quien solicita el préstamo.' : undefined}>
              <input
                data-autofocus
                type="text"
                autoComplete="off"
                maxLength={60}
                placeholder="Ej.: Carlos Mendoza"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </main>
        <div className={BOTTOM_BAR}>
          <Button type="submit" block size="lg">
            Continuar
          </Button>
        </div>
      </form>
    </>
  )
}
