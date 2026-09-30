import { useCallback, useEffect, useState } from 'react'
import { addDays, parseAmountToMinor, toLocalDate, type Loan, type LocalDate } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { FlowFrame } from '../flow/FlowFrame'
import { BorrowerStep, DateStep, InstallmentsStep, LoanAmountStep, nextDay } from './LoanSteps'
import { ReceiptScreen } from './ReceiptScreen'
import { SummaryStep } from './SummaryStep'

type Step = 'amount' | 'installments' | 'loanDate' | 'dueDate' | 'borrower' | 'summary'
const ORDER: Step[] = ['amount', 'installments', 'loanDate', 'dueDate', 'borrower', 'summary']

interface Draft {
  amountRaw: string
  installmentCount: number | null
  loanDate: LocalDate
  dueDate: LocalDate
  borrowerName: string
}

/**
 * Nuevo préstamo: monto → cuotas → fecha del préstamo → fecha límite → persona →
 * resumen → creación → comprobante. Recuerda lo elegido al ir y volver.
 */
export function NewLoanFlow({ onClose }: { onClose(): void }) {
  const { now } = useServices()
  const finance = useFinance()
  const [step, setStep] = useState<Step>('amount')
  const [draft, setDraft] = useState<Draft>(() => {
    const today = toLocalDate(now())
    return { amountRaw: '', installmentCount: null, loanDate: today, dueDate: addDays(today, 30), borrowerName: '' }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Loan | null>(null)

  const patch = (changes: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...changes }))
  const principal = parseAmountToMinor(draft.amountRaw) ?? 0

  const back = useCallback(() => {
    const i = ORDER.indexOf(step)
    if (i > 0) setStep(ORDER[i - 1] ?? 'amount')
    else onClose()
  }, [step, onClose])
  const forward = () => setStep(ORDER[ORDER.indexOf(step) + 1] ?? 'summary')

  useEffect(() => {
    if (created) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [back, created])

  const create = async () => {
    if (saving || draft.installmentCount === null) return
    setSaving(true)
    setError(null)
    const result = await finance.createLoan({
      borrowerName: draft.borrowerName,
      principalAmount: principal,
      installmentCount: draft.installmentCount,
      loanDate: draft.loanDate,
      dueDate: draft.dueDate,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error.message ?? Object.values(result.error.fields ?? {})[0] ?? 'No se pudo crear el préstamo.')
      return
    }
    setCreated(result.value.loan)
  }

  if (created) return <ReceiptScreen loan={created} mode="created" onClose={onClose} />

  return (
    <FlowFrame>
      <div key={step} className="flex min-h-0 flex-1 animate-step flex-col">
        {step === 'amount' ? (
          <LoanAmountStep
            variant="loan"
            amountRaw={draft.amountRaw}
            onChangeAmount={(amountRaw) => patch({ amountRaw })}
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'installments' ? (
          <InstallmentsStep
            variant="loan"
            principal={principal}
            count={draft.installmentCount}
            onChangeCount={(installmentCount) => patch({ installmentCount })}
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'loanDate' ? (
          <DateStep
            title="¿Qué fecha se presta?"
            label="Fecha del préstamo"
            value={draft.loanDate}
            onChange={(loanDate) =>
              patch(draft.dueDate <= loanDate ? { loanDate, dueDate: addDays(loanDate, 30) } : { loanDate })
            }
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'dueDate' ? (
          <DateStep
            title="¿Qué fecha debe pagar?"
            label="Fecha límite de pago"
            value={draft.dueDate}
            min={nextDay(draft.loanDate)}
            onChange={(dueDate) => patch({ dueDate })}
            onBack={back}
            onContinue={forward}
          />
        ) : step === 'borrower' ? (
          <BorrowerStep
            value={draft.borrowerName}
            onChange={(borrowerName) => patch({ borrowerName })}
            onBack={back}
            onContinue={forward}
          />
        ) : (
          <SummaryStep
            borrowerName={draft.borrowerName}
            principal={principal}
            amountRaw={draft.amountRaw}
            installmentCount={draft.installmentCount ?? 1}
            loanDate={draft.loanDate}
            dueDate={draft.dueDate}
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
