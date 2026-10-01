import { useCallback, useEffect, useState } from 'react'
import {
  FREQUENCY_LABEL,
  FREQUENCY_UNIT,
  MAX_JAR_NAME_LENGTH,
  SAVINGS_FREQUENCIES,
  appendAmountKey,
  formatAmountInput,
  formatLoanDate,
  formatMoney,
  parseAmountToMinor,
  toLocalDate,
  type LocalDate,
  type SavingsFrequency,
  type SavingsJar,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { cx } from '../cx'
import { Button } from '../components/Button'
import { Field, inputClass } from '../components/Field'
import { Icon } from '../components/Icon'
import { AmountDisplay } from '../flow/AmountDisplay'
import { FlowFrame, FlowHeader } from '../flow/FlowFrame'
import { NumericKeypad } from '../flow/NumericKeypad'
import { BOTTOM_BAR, DecorativeIcon, SummaryLine, nextDay } from '../loans/LoanSteps'

type Step = 'name' | 'target' | 'plan' | 'amount' | 'summary'
const ORDER: Step[] = ['name', 'target', 'plan', 'amount', 'summary']

interface Draft {
  name: string
  targetRaw: string
  frequency: SavingsFrequency
  amountRaw: string
  targetDate: LocalDate | null
}

interface NewJarFlowProps {
  onClose(): void
  onCreated(jar: SavingsJar): void
}

/** Nuevo frasco: nombre → objetivo → plan (semanal/quincenal/mensual) → monto a aportar → crear. */
export function NewJarFlow({ onClose, onCreated }: NewJarFlowProps) {
  const { now } = useServices()
  const { createJar } = useFinance()
  const [step, setStep] = useState<Step>('name')
  const [draft, setDraft] = useState<Draft>({
    name: '',
    targetRaw: '',
    frequency: 'MONTHLY',
    amountRaw: '',
    targetDate: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (changes: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...changes }))
  const target = parseAmountToMinor(draft.targetRaw) ?? 0
  const planAmount = parseAmountToMinor(draft.amountRaw) ?? 0
  const today = toLocalDate(now())

  const back = useCallback(() => {
    const i = ORDER.indexOf(step)
    if (i > 0) setStep(ORDER[i - 1] ?? 'name')
    else onClose()
  }, [step, onClose])
  const forward = () => setStep(ORDER[ORDER.indexOf(step) + 1] ?? 'summary')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [back])

  const create = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await createJar({
      name: draft.name,
      targetAmount: target,
      targetDate: draft.targetDate,
      plan: { frequency: draft.frequency, amount: planAmount },
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error.message ?? Object.values(result.error.fields ?? {})[0] ?? 'No se pudo crear el frasco.')
      return
    }
    onCreated(result.value)
  }

  return (
    <FlowFrame>
      <div key={step} className="flex min-h-0 flex-1 animate-step flex-col">
        {step === 'name' ? (
          <NameStep value={draft.name} onChange={(name) => patch({ name })} onBack={back} onContinue={forward} />
        ) : step === 'target' ? (
          <KeypadStep
            title="Objetivo final"
            label="¿Cuánto querés juntar?"
            subtitle={draft.name.trim()}
            icon="jar"
            amountRaw={draft.targetRaw}
            onChangeAmount={(targetRaw) => patch({ targetRaw })}
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'plan' ? (
          <PlanStep
            value={draft.frequency}
            onChange={(frequency) => patch({ frequency })}
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'amount' ? (
          <KeypadStep
            title={`Aporte ${FREQUENCY_LABEL[draft.frequency].toLowerCase()}`}
            label={`Monto a aportar por ${FREQUENCY_UNIT[draft.frequency]}`}
            subtitle={`Objetivo ${formatMoney(target)}`}
            icon="calendar"
            amountRaw={draft.amountRaw}
            onChangeAmount={(amountRaw) => patch({ amountRaw })}
            onBack={back}
            onContinue={forward}
            maxMinor={target}
            maxMessage="El aporte no puede superar el objetivo."
            hint={
              planAmount > 0 && target > 0
                ? `Llegarías al objetivo en ${Math.ceil(target / planAmount)} ${Math.ceil(target / planAmount) === 1 ? 'aporte' : 'aportes'}`
                : undefined
            }
          />
        ) : (
          <SummaryStep
            name={draft.name.trim()}
            target={target}
            frequency={draft.frequency}
            planAmount={planAmount}
            targetDate={draft.targetDate}
            today={today}
            onChangeDate={(targetDate) => patch({ targetDate })}
            saving={saving}
            error={error}
            onBack={back}
            onCreate={() => void create()}
          />
        )}
      </div>
    </FlowFrame>
  )
}

/* ── Paso 1: nombre ─────────────────────────────────────────────────────── */

function NameStep({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: string
  onChange(name: string): void
  onBack(): void
  onContinue(): void
}) {
  const [touched, setTouched] = useState(false)
  const empty = value.trim() === ''
  return (
    <>
      <FlowHeader onBack={onBack} backLabel="Volver" title="Nuevo frasco" trailing={<DecorativeIcon name="jar" />} />
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
          <h1 className="type-display">¿Cómo se llama tu frasco?</h1>
          <div className="mt-8">
            <Field label="Nombre" error={touched && empty ? 'Poné un nombre al frasco.' : undefined}>
              <input
                data-autofocus
                type="text"
                autoComplete="off"
                maxLength={MAX_JAR_NAME_LENGTH}
                placeholder="Ej.: Vacaciones"
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

/* ── Pasos con teclado numérico (objetivo y aporte) ─────────────────────── */

function KeypadStep({
  title,
  label,
  subtitle,
  icon,
  amountRaw,
  onChangeAmount,
  onBack,
  onContinue,
  hint,
  maxMinor,
  maxMessage,
}: {
  title: string
  label: string
  subtitle: string
  icon: 'jar' | 'calendar'
  amountRaw: string
  onChangeAmount(raw: string): void
  onBack(): void
  onContinue(): void
  hint?: string | undefined
  maxMinor?: number
  maxMessage?: string
}) {
  const minor = parseAmountToMinor(amountRaw)
  const tooBig = maxMinor !== undefined && minor !== null && minor > maxMinor
  const valid = minor !== null && minor > 0 && !tooBig
  return (
    <>
      <FlowHeader
        onBack={onBack}
        backLabel="Volver"
        title={title}
        heading
        subtitle={subtitle}
        trailing={<DecorativeIcon name={icon} />}
      />
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
        <AmountDisplay text={formatAmountInput(amountRaw)} currency="ARS" empty={!valid && !tooBig} />
        <p className="text-body text-fg-muted">{label}</p>
        {tooBig ? (
          <p role="alert" className="text-body-sm text-danger">
            {maxMessage}
          </p>
        ) : hint ? (
          <p className="text-body-sm text-fg-soft">{hint}</p>
        ) : null}
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

/* ── Paso 3: plan ───────────────────────────────────────────────────────── */

function PlanStep({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: SavingsFrequency
  onChange(value: SavingsFrequency): void
  onBack(): void
  onContinue(): void
}) {
  return (
    <>
      <FlowHeader onBack={onBack} backLabel="Volver" title="Nuevo frasco" trailing={<DecorativeIcon name="calendar" />} />
      <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-4">
        <h1 className="type-display">¿Cada cuánto ahorrás?</h1>
        <div role="radiogroup" aria-label="Plan de ahorro" className="mt-8 grid grid-cols-3 gap-2.5">
          {SAVINGS_FREQUENCIES.map((frequency) => {
            const selected = value === frequency
            return (
              <button
                key={frequency}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(frequency)}
                className={cx(
                  'interactive grid h-14 place-items-center rounded-card text-body font-medium',
                  selected ? 'bg-action text-on-action' : 'bg-sunken text-fg hover:bg-sunken-hover',
                )}
              >
                {FREQUENCY_LABEL[frequency]}
              </button>
            )
          })}
        </div>
      </main>
      <div className={BOTTOM_BAR}>
        <Button block size="lg" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  )
}

/* ── Paso 5: resumen, fecha opcional y crear ────────────────────────────── */

function SummaryStep({
  name,
  target,
  frequency,
  planAmount,
  targetDate,
  today,
  onChangeDate,
  saving,
  error,
  onBack,
  onCreate,
}: {
  name: string
  target: number
  frequency: SavingsFrequency
  planAmount: number
  targetDate: LocalDate | null
  today: LocalDate
  onChangeDate(date: LocalDate | null): void
  saving: boolean
  error: string | null
  onBack(): void
  onCreate(): void
}) {
  return (
    <>
      <FlowHeader onBack={onBack} backLabel="Volver" title="Resumen del frasco" heading trailing={<DecorativeIcon name="jar" />} />
      <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-4">
        <dl className="flex flex-col gap-3" aria-label="Resumen del frasco">
          <SummaryLine label="Nombre" value={name} />
          <SummaryLine label="Objetivo" value={formatMoney(target)} strong />
          <SummaryLine label="Plan" value={FREQUENCY_LABEL[frequency]} />
          <SummaryLine label={`Aporte por ${FREQUENCY_UNIT[frequency]}`} value={formatMoney(planAmount)} />
        </dl>

        <div className="relative mt-6 flex items-center justify-between gap-4 rounded-card bg-sunken p-5">
          <label className="relative flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-body-sm text-fg-soft">Fecha objetivo (opcional)</span>
              <span className="type-subheading mt-1 block text-fg">
                {targetDate ? formatLoanDate(targetDate) : 'Sin fecha'}
              </span>
            </span>
            <Icon name="calendar" size="lg" className="text-fg-soft" />
            <input
              type="date"
              aria-label="Fecha objetivo"
              value={targetDate ?? ''}
              min={nextDay(today)}
              onChange={(event) => onChangeDate(event.target.value || null)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          {targetDate ? (
            <Button size="sm" variant="tertiary" onClick={() => onChangeDate(null)} aria-label="Quitar fecha objetivo">
              Quitar
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-control bg-danger-bg p-3 text-body-sm text-danger">
            {error}
          </p>
        ) : null}
      </main>
      <div className={BOTTOM_BAR}>
        <Button block size="lg" loading={saving} onClick={onCreate}>
          Crear frasco
        </Button>
      </div>
    </>
  )
}
