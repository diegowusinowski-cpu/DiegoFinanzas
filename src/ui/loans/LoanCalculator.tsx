import { useEffect, useState } from 'react'
import { parseAmountToMinor } from '@/domain'
import { FlowFrame } from '../flow/FlowFrame'
import { InstallmentsStep, LoanAmountStep } from './LoanSteps'

/** Calculadora: monto → interés 70 % → total → cuotas. Solo calcula: no crea ni guarda nada. */
export function LoanCalculator({ onClose }: { onClose(): void }) {
  const [step, setStep] = useState<'amount' | 'installments'>('amount')
  const [amountRaw, setAmountRaw] = useState('')
  const [count, setCount] = useState<number | null>(null)

  const back = () => (step === 'installments' ? setStep('amount') : onClose())

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (step === 'installments') setStep('amount')
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step, onClose])

  return (
    <FlowFrame>
      <div key={step} className="flex min-h-0 flex-1 animate-step flex-col">
        {step === 'amount' ? (
          <LoanAmountStep
            variant="calculator"
            amountRaw={amountRaw}
            onChangeAmount={setAmountRaw}
            onBack={back}
            onContinue={() => setStep('installments')}
          />
        ) : (
          <InstallmentsStep
            variant="calculator"
            principal={parseAmountToMinor(amountRaw) ?? 0}
            count={count}
            onChangeCount={setCount}
            onBack={back}
            onContinue={onClose}
            continueLabel="Listo"
          />
        )}
      </div>
    </FlowFrame>
  )
}
