import { useState, type FormEvent } from 'react'
import {
  MAX_REMINDER_DESCRIPTION_LENGTH,
  MAX_REMINDER_TITLE_LENGTH,
  toLocalDate,
  type ReminderErrors,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { Button } from './Button'
import { Field, inputClass } from './Field'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

export function ReminderSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo recordatorio">
      <ReminderForm onDone={onClose} />
    </Sheet>
  )
}

function ReminderForm({ onDone }: { onDone(): void }) {
  const { now } = useServices()
  const { addReminder } = useFinance()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(() => toLocalDate(now()))
  const [errors, setErrors] = useState<ReminderErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError(null)
    const result = await addReminder({ title, description, dueDate })
    setSaving(false)
    if (!result.ok) {
      setErrors(result.error.fields ?? {})
      setFormError(result.error.message ?? null)
      return
    }
    toast.show('Recordatorio guardado')
    onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5 pb-2">
      <Field label="Título" error={errors.title}>
        <input
          data-autofocus
          type="text"
          autoComplete="off"
          maxLength={MAX_REMINDER_TITLE_LENGTH}
          placeholder="Ej.: Cuota del 6 de Octubre"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Detalle (opcional)" error={errors.description}>
        <textarea
          rows={3}
          maxLength={MAX_REMINDER_DESCRIPTION_LENGTH}
          className={`${inputClass} min-h-24 resize-none py-3`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Fecha" error={errors.dueDate}>
        <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      {formError ? (
        <p role="alert" className="rounded-control border border-danger/40 bg-danger/10 p-3 text-body-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" block loading={saving}>
        Guardar recordatorio
      </Button>
    </form>
  )
}
