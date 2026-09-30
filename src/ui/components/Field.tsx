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
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl font-bold text-muted">
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
        <p id={messageId} role="alert" className="text-sm font-medium text-expense">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'min-h-13 w-full rounded-control border border-line bg-canvas px-4 text-base text-ink placeholder:text-muted/70 outline-none transition focus:border-ink focus:bg-surface aria-[invalid=true]:border-expense'
