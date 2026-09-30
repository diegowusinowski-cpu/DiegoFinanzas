import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

interface FieldProps {
  label: string
  error?: string | undefined
  hint?: ReactNode
  /** Texto fijo a la izquierda del control (p. ej. el símbolo `$`). */
  prefix?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}

/** Etiqueta + control + error/ayuda, con los atributos ARIA conectados. */
export function Field({ label, error, hint, prefix, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const hasMessage = Boolean(error) || Boolean(hint)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-eyebrow">
        {label}
      </label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center type-subheading text-fg-soft">
            {prefix}
          </span>
        ) : null}
        {cloneElement(children, {
          id,
          'aria-invalid': error ? true : undefined,
          ...(hasMessage ? { 'aria-describedby': messageId } : {}),
        } as Partial<ReactElement<Record<string, unknown>>['props']>)}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-body-sm text-fg-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'interactive min-h-input w-full rounded-control border border-transparent bg-sunken px-4 text-body text-fg outline-none focus:border-fg focus:bg-surface aria-[invalid=true]:border-danger'
