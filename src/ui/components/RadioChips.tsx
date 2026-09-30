import { useId } from 'react'
import { cx } from '../cx'

interface Option<V extends string> {
  value: V
  label: string
}

interface RadioChipsProps<V extends string> {
  legend: string
  value: V | ''
  options: readonly Option<V>[]
  onChange(value: V): void
  error?: string | undefined
  /** `segmented`: ocupa el ancho en partes iguales. `chips`: se acomoda en filas. */
  layout?: 'segmented' | 'chips'
  tone?: (value: V) => 'neutral' | 'income' | 'expense'
}

const TONES = {
  neutral: 'peer-checked:bg-action peer-checked:text-fg-on-action',
  income: 'peer-checked:bg-iris-gleam peer-checked:text-void',
  expense: 'peer-checked:bg-orchid-bloom peer-checked:text-void',
}

/** Grupo de opciones excluyentes basado en radios nativos (accesible por teclado). */
export function RadioChips<V extends string>({
  legend,
  value,
  options,
  onChange,
  error,
  layout = 'chips',
  tone = () => 'neutral',
}: RadioChipsProps<V>) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="type-eyebrow mb-2">{legend}</legend>
      <div className={cx(layout === 'segmented' ? 'grid grid-flow-col auto-cols-fr gap-2 rounded-pill border border-line bg-void p-1' : 'flex flex-wrap gap-2')}>
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cx(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-pill px-4 text-body-sm transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pure',
                layout === 'segmented' ? 'text-fg-soft' : 'border border-line bg-glass text-fg-heading hover:bg-glass-strong',
                TONES[tone(option.value)],
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
