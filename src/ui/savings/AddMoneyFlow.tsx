import { useEffect, useState } from 'react'
import {
  appendAmountKey,
  formatAmountInput,
  formatMoney,
  parseAmountToMinor,
  type SavingsJar,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { Button } from '../components/Button'
import { useToast } from '../components/Toast'
import { AmountDisplay } from '../flow/AmountDisplay'
import { FlowFrame, FlowHeader } from '../flow/FlowFrame'
import { NumericKeypad } from '../flow/NumericKeypad'
import { BOTTOM_BAR, DecorativeIcon } from '../loans/LoanSteps'

/**
 * Agregar dinero a un frasco. Solo reserva dinero (no es un gasto): el saldo total queda igual y
 * baja el dinero disponible sin asignar.
 */
export function AddMoneyFlow({ jar, onClose }: { jar: SavingsJar; onClose(): void }) {
  const { savings, addToJar } = useFinance()
  const toast = useToast()
  const [amountRaw, setAmountRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minor = parseAmountToMinor(amountRaw)
  const tooBig = minor !== null && minor > savings.available
  const valid = minor !== null && minor > 0 && !tooBig

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const confirm = async () => {
    if (!valid || saving || minor === null) return
    setSaving(true)
    setError(null)
    const result = await addToJar(jar.id, minor)
    setSaving(false)
    if (!result.ok) {
      setError(result.error.message ?? 'No se pudo agregar el dinero.')
      return
    }
    toast.show(`Agregaste ${formatMoney(minor)} a ${jar.name}`)
    onClose()
  }

  return (
    <FlowFrame className="animate-sheet">
      <FlowHeader
        onBack={onClose}
        backLabel="Cerrar"
        title="Agregar dinero"
        heading
        subtitle={jar.name}
        trailing={<DecorativeIcon name="jar" />}
      />
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
        <AmountDisplay text={formatAmountInput(amountRaw)} currency="ARS" empty={!valid && !tooBig} />
        <p className="text-body text-fg-muted">Disponible sin asignar: {formatMoney(Math.max(0, savings.available))}</p>
        {tooBig || error ? (
          <p role="alert" className="text-body-sm text-danger">
            {tooBig ? 'No tenés tanto dinero disponible sin asignar.' : error}
          </p>
        ) : (
          <p className="text-body-sm text-fg-soft">Este dinero sigue en tu saldo: solo queda reservado.</p>
        )}
      </section>
      <div className="shrink-0 pb-2">
        <NumericKeypad onKey={(key) => setAmountRaw((raw) => appendAmountKey(raw, key))} />
      </div>
      <div className={BOTTOM_BAR}>
        <Button block size="lg" loading={saving} disabled={!valid} onClick={() => void confirm()}>
          Agregar al frasco
        </Button>
      </div>
    </FlowFrame>
  )
}
