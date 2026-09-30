import type { CurrencyCode } from '@/domain'
import { cx } from '../cx'

interface AmountDisplayProps {
  /** Monto ya formateado (`10.000,5`). */
  text: string
  currency: CurrencyCode
  /** Monto en cero: se muestra atenuado hasta que se escribe algo. */
  empty?: boolean
}

/** Monto protagonista: cifra oscura + moneda en gris; se achica si el texto es largo. */
export function AmountDisplay({ text, currency, empty = false }: AmountDisplayProps) {
  const length = text.length + 1 + currency.length
  const size = length <= 10 ? 'type-amount' : length <= 13 ? 'type-amount-md' : 'type-amount-sm'
  return (
    <p
      data-testid="amount-display"
      aria-label={`Monto: ${text} ${currency}`}
      className={cx('whitespace-nowrap', size)}
    >
      <span className={empty ? 'text-fg-muted' : 'text-fg'}>{text}</span>{' '}
      <span className="ml-[0.08em] text-fg-muted">{currency}</span>
    </p>
  )
}
