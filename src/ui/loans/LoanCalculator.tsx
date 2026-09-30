import { useEffect, useState } from 'react'
import {
  LOAN_INTEREST_PERCENT,
  appendAmountKey,
  calculateLoan,
  formatAmountInput,
  formatMoney,
  parseAmountToMinor,
} from '@/domain'
import { Button } from '../components/Button'
import { AmountDisplay } from '../flow/AmountDisplay'
import { FlowFrame, FlowHeader } from '../flow/FlowFrame'
import { NumericKeypad } from '../flow/NumericKeypad'
import { BOTTOM_BAR, DecorativeIcon, SummaryLine } from './LoanSteps'

/**
 * Calculadora financiera: herramienta de consulta independiente. Se escribe el monto, se ve el
 * interés del 70 % y el total a devolver, y se cierra. No crea préstamos, cuotas, movimientos ni
 * comprobantes, no pide datos y no toca el saldo: solo guarda el monto tipeado en pantalla.
 */
export function LoanCalculator({ onClose }: { onClose(): void }) {
  const [amountRaw, setAmountRaw] = useState('')
  const minor = parseAmountToMinor(amountRaw)
  const valid = minor !== null && minor > 0
  const calc = calculateLoan(minor ?? 0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <FlowFrame>
      <div className="flex min-h-0 flex-1 animate-step flex-col">
        <FlowHeader
          onBack={onClose}
          backLabel="Cerrar calculadora"
          title="Calculadora financiera"
          heading
          subtitle={`Interés fijo del ${LOAN_INTEREST_PERCENT}%`}
          trailing={<DecorativeIcon name="calculator" />}
        />

        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-gutter text-center">
          <div className="flex flex-col items-center gap-2">
            <AmountDisplay text={formatAmountInput(amountRaw)} currency="ARS" empty={!valid} />
            <p className="text-body text-fg-muted">Monto a prestar</p>
          </div>
          <dl className="flex w-full flex-col gap-2" aria-label="Cálculo del préstamo" aria-live="polite">
            <SummaryLine label="Monto a prestar" value={formatMoney(calc.principal)} />
            <SummaryLine label={`Interés ${LOAN_INTEREST_PERCENT}%`} value={formatMoney(calc.interest)} />
            <SummaryLine label="Total a devolver" value={formatMoney(calc.total)} strong />
          </dl>
        </section>

        <div className="shrink-0 pb-2">
          <NumericKeypad onKey={(key) => setAmountRaw((raw) => appendAmountKey(raw, key))} />
        </div>
        <div className={BOTTOM_BAR}>
          <Button block size="lg" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </FlowFrame>
  )
}
