import { useMemo, useState, type FormEvent } from 'react'
import {
  MAX_DESCRIPTION_LENGTH,
  categoriesForType,
  formatMoney,
  parseAmountToMinor,
  toLocalDate,
  toLocalTime,
  type TransactionType,
  type ValidationErrors,
} from '@/domain'
import { useServices } from '@/state/ServicesContext'
import { useFinance } from '@/state/FinanceContext'
import { Button } from './Button'
import { Field, inputClass } from './Field'
import { RadioChips } from './RadioChips'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

interface TransactionSheetProps {
  open: boolean
  initialType: TransactionType
  onClose(): void
}

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'INCOME', label: 'Ingreso' },
] as const

export function TransactionSheet({ open, initialType, onClose }: TransactionSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo movimiento">
      <TransactionForm initialType={initialType} onDone={onClose} />
    </Sheet>
  )
}

function TransactionForm({ initialType, onDone }: { initialType: TransactionType; onDone(): void }) {
  const { now } = useServices()
  const { categories, addTransaction } = useFinance()
  const toast = useToast()

  const [type, setType] = useState<TransactionType>(initialType)
  const [amountText, setAmountText] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(() => toLocalDate(now()))
  const [time, setTime] = useState(() => toLocalTime(now()))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const typeCategories = useMemo(() => categoriesForType(categories, type), [categories, type])
  const income = type === 'INCOME'

  const changeType = (next: TransactionType) => {
    setType(next)
    setCategoryId('')
    setErrors((prev) => {
      const next = { ...prev }
      delete next.categoryId
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const amount = parseAmountToMinor(amountText)
    if (amount === null || amount <= 0) {
      setErrors({ amount: 'Ingresá un monto válido mayor a cero.' })
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await addTransaction({ type, amount, description, categoryId, date, time })
    setSaving(false)
    if (!result.ok) {
      setErrors(result.error.fields ?? {})
      setFormError(result.error.message ?? null)
      return
    }
    toast.show(
      result.value.status === 'SCHEDULED'
        ? 'Movimiento programado'
        : `${income ? 'Ingreso' : 'Gasto'} registrado: ${formatMoney(result.value.amount)}`,
    )
    onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5 pb-2">
      <RadioChips
        legend="Tipo de movimiento"
        layout="segmented"
        value={type}
        options={TYPE_OPTIONS}
        onChange={changeType}
        tone={(v) => (v === 'INCOME' ? 'income' : 'expense')}
      />

      <Field label="Monto" error={errors.amount} prefix="$">
        <input
          data-autofocus
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          className={`${inputClass} pl-10 font-display text-title font-light tabular-nums`}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))}
        />
      </Field>

      <Field label="Descripción" error={errors.description}>
        <input
          type="text"
          autoComplete="off"
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder={income ? 'Ej.: Cobro de trabajo' : 'Ej.: Supermercado'}
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <RadioChips
        legend="Categoría"
        value={categoryId}
        options={typeCategories.map((c) => ({ value: c.id, label: c.name }))}
        onChange={setCategoryId}
        error={errors.categoryId}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" error={errors.date}>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora" error={errors.time}>
          <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      {formError ? (
        <p role="alert" className="rounded-control border border-danger/40 bg-danger/10 p-3 text-body-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" block loading={saving}>
        {income ? 'Registrar ingreso' : 'Registrar gasto'}
      </Button>
    </form>
  )
}
