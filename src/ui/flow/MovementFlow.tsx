import { useCallback, useEffect, useState } from 'react'
import {
  currencyForCountry,
  findCategory,
  formatAmountInput,
  parseAmountToMinor,
  toLocalDate,
  toLocalTime,
  type TransactionType,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { AmountStep } from './AmountStep'
import { ConfirmStep } from './ConfirmStep'
import { DoneStep } from './DoneStep'
import { COUNTRY_INFO, previousStep, type FlowData, type FlowStep } from './flowModel'
import { FlowFrame } from './FlowFrame'
import { CategoryStep, CountryStep, HolderStep } from './SelectionSteps'

interface MovementFlowProps {
  type: TransactionType
  /** Cierra el flujo (cancelar o terminar) y deja ver el Home. */
  onClose(): void
}

/**
 * Flujo de registro: país → titular → tipo/categoría → monto → confirmación →
 * movimiento confirmado → Home. Recuerda todo lo elegido al ir y volver.
 */
export function MovementFlow({ type, onClose }: MovementFlowProps) {
  const { now } = useServices()
  const finance = useFinance()
  const [step, setStep] = useState<FlowStep>('country')
  const [data, setData] = useState<FlowData>(() => ({
    type,
    country: 'AR',
    holder: 'INDIVIDUAL',
    categoryId: '',
    amountRaw: '',
    concept: '',
    paymentMethod: 'TRANSFER',
    date: toLocalDate(now()),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (changes: Partial<FlowData>) => setData((prev) => ({ ...prev, ...changes }))
  const category = findCategory(finance.categories, data.categoryId)
  const currency = COUNTRY_INFO[data.country].currency

  const back = () => {
    const prev = previousStep(step)
    if (prev) setStep(prev)
    else onClose()
  }

  const confirm = async () => {
    const amount = parseAmountToMinor(data.amountRaw)
    if (amount === null || amount <= 0 || !category || saving) return
    setSaving(true)
    setError(null)
    const result = await finance.addTransaction({
      type: data.type,
      amount,
      description: data.concept.trim() || category.name,
      categoryId: category.id,
      country: data.country,
      currency: currencyForCountry(data.country),
      holder: data.holder,
      paymentMethod: data.paymentMethod,
      date: data.date,
      time: toLocalTime(now()),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error.message ?? Object.values(result.error.fields ?? {})[0] ?? 'No se pudo guardar el movimiento.')
      return
    }
    setStep('done')
  }

  const finished = useCallback(() => onClose(), [onClose])

  // Esc vuelve un paso (o cierra en el primero), como el botón de volver.
  useEffect(() => {
    if (step === 'done') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const prev = previousStep(step)
      if (prev) setStep(prev)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step, onClose])

  const nav = { onBack: back, backLabel: step === 'country' ? 'Cerrar' : 'Volver' }

  return (
    <FlowFrame>
      <div key={step === 'done' ? 'confirm' : step} className="flex min-h-0 flex-1 animate-step flex-col">
        {step === 'country' ? (
          <CountryStep
            {...nav}
            onSelect={(country) => {
              patch({ country })
              setStep('holder')
            }}
          />
        ) : step === 'holder' ? (
          <HolderStep
            {...nav}
            onSelect={(holder) => {
              patch({ holder })
              setStep('category')
            }}
          />
        ) : step === 'category' ? (
          <CategoryStep
            {...nav}
            type={data.type}
            categories={finance.categories}
            onSelect={(picked) => {
              patch({ categoryId: picked.id })
              setStep('amount')
            }}
          />
        ) : step === 'amount' ? (
          <AmountStep
            type={data.type}
            country={data.country}
            category={category}
            amountRaw={data.amountRaw}
            concept={data.concept}
            balance={finance.balanceOf(currency)}
            onChangeAmount={(amountRaw) => patch({ amountRaw })}
            onChangeConcept={(concept) => patch({ concept })}
            onChangeCountry={(country) => patch({ country })}
            paymentMethod={data.paymentMethod}
            onChangePaymentMethod={(paymentMethod) => patch({ paymentMethod })}
            onBack={back}
            onContinue={() => setStep('confirm')}
          />
        ) : (
          <ConfirmStep
            type={data.type}
            country={data.country}
            category={category}
            amountRaw={data.amountRaw}
            paymentMethod={data.paymentMethod}
            date={data.date}
            saving={saving}
            error={error}
            onChangeMethod={(paymentMethod) => patch({ paymentMethod })}
            onChangeDate={(date) => patch({ date })}
            onBack={back}
            onConfirm={() => void confirm()}
          />
        )}
      </div>
      {step === 'done' ? (
        <DoneStep text={formatAmountInput(data.amountRaw)} currency={currency} onFinished={finished} />
      ) : null}
    </FlowFrame>
  )
}
