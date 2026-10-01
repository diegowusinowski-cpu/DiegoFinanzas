import { useState } from 'react'
import { parseAmountToMinor, validateUsdBalance, type MinorUnits } from '@/domain'
import { Button } from './Button'
import { Field, inputClass } from './Field'
import { Sheet } from './Sheet'

/** `100000` → `1000`, `125050` → `1250,50` (para precargar el campo). */
function toInputText(minor: MinorUnits): string {
  if (minor === 0) return ''
  const whole = Math.trunc(minor / 100)
  const cents = minor % 100
  return cents === 0 ? String(whole) : `${whole},${String(cents).padStart(2, '0')}`
}

interface UsdBalanceSheetProps {
  open: boolean
  /** Dólares guardados hoy. */
  current: MinorUnits
  onClose(): void
  onSave(amount: MinorUnits): Promise<string | null>
}

/** Cargar o modificar a mano cuántos dólares tenés. Se guarda en dólares; no es un gasto ni toca los pesos. */
export function UsdBalanceSheet({ open, current, onClose, onSave }: UsdBalanceSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Saldo en dólares">
      {/* El formulario se monta al abrir la hoja, así siempre parte del valor guardado. */}
      <UsdBalanceForm current={current} onClose={onClose} onSave={onSave} />
    </Sheet>
  )
}

function UsdBalanceForm({ current, onClose, onSave }: Omit<UsdBalanceSheetProps, 'open'>) {
  const [text, setText] = useState(() => toInputText(current))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (saving) return
    const amount = parseAmountToMinor(text)
    const problem = validateUsdBalance(amount)
    if (problem || amount === null) {
      setError(problem)
      return
    }
    setSaving(true)
    const failure = await onSave(amount)
    setSaving(false)
    if (failure) setError(failure)
    else onClose()
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 pb-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field
        label="Dólares que tenés"
        prefix="US$"
        error={error ?? undefined}
        hint="Se guarda en dólares. No es un gasto y no cambia tu saldo en pesos."
      >
        <input
          data-autofocus
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
          className={`${inputClass} pl-14`}
        />
      </Field>
      <Button type="submit" block size="lg" loading={saving}>
        Guardar
      </Button>
    </form>
  )
}
