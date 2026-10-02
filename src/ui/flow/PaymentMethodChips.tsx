import { PAYMENT_METHODS, type PaymentMethod } from '@/domain'
import { cx } from '../cx'
import { Icon } from '../components/Icon'
import { PAYMENT_LABEL } from './flowModel'

interface PaymentMethodChipsProps {
  value: PaymentMethod
  onChange(method: PaymentMethod): void
  /** Nombre del grupo para lectores de pantalla (o `labelledBy` si ya hay un título visible). */
  label?: string
  labelledBy?: string
}

/** Elegir si el movimiento fue en efectivo o por transferencia. Se usa en el monto y en la confirmación. */
export function PaymentMethodChips({ value, onChange, label, labelledBy }: PaymentMethodChipsProps) {
  return (
    <div
      role="radiogroup"
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label ?? 'Efectivo o transferencia' })}
      className="flex gap-1.5"
    >
      {PAYMENT_METHODS.map((method) => {
        const selected = method === value
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(method)}
            className={cx(
              'interactive inline-flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-body-sm font-medium',
              selected ? 'bg-action text-on-action' : 'bg-sunken text-fg-soft hover:bg-sunken-hover',
            )}
          >
            <Icon name={method === 'CASH' ? 'banknote' : 'transfer'} size="sm" />
            {PAYMENT_LABEL[method]}
          </button>
        )
      })}
    </div>
  )
}
