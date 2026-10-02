import { cx } from '../cx'
import { Icon } from './Icon'

/** Ícono de billete que marca un movimiento en efectivo (junto a la fecha). */
export function CashBadge({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Efectivo" data-testid="cash-badge" className={cx('inline-flex shrink-0 text-fg-soft', className)}>
      <Icon name="banknote" size="sm" />
    </span>
  )
}
