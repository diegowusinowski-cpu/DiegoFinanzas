import { formatMoney, formatRelativeDate, type Category, type Transaction } from '@/domain'
import { cx } from '../cx'
import { CashBadge } from './CashBadge'
import { Icon } from './Icon'

interface MovementItemProps {
  transaction: Transaction
  category: Category | undefined
  today: string
}

/** Fila de movimiento: ícono, descripción + detalle, monto alineado a la derecha. */
export function MovementItem({ transaction, category, today }: MovementItemProps) {
  const income = transaction.type === 'INCOME'
  const cancelled = transaction.status === 'CANCELLED'
  const scheduled = transaction.status === 'SCHEDULED'
  const sign = income ? '+' : '−'
  const typeLabel = income ? 'Ingreso' : 'Gasto'

  return (
    <li className="flex items-center gap-3 py-row">
      <span
        className={cx(
          'grid size-avatar shrink-0 place-items-center rounded-pill',
          income ? 'bg-positive-bg text-positive' : 'bg-sunken text-fg',
          cancelled && 'opacity-40',
        )}
      >
        <Icon name={income ? 'arrow-down' : 'arrow-up'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('type-subheading truncate', cancelled ? 'text-fg-muted line-through' : 'text-fg')}>
          {transaction.description}
        </p>
        <p className="flex items-center gap-1.5 text-body-sm text-fg-soft">
          {transaction.paymentMethod === 'CASH' ? <CashBadge /> : null}
          <span className="min-w-0 truncate">
          {typeLabel} · {formatRelativeDate(transaction.date, today)}, {transaction.time}
          {category ? ` · ${category.name}` : ''}
          {scheduled || cancelled ? (
            <span className="ml-1.5 rounded-chip bg-sunken px-1.5 py-0.5 text-caption font-medium">
              {scheduled ? 'Programado' : 'Anulado'}
            </span>
          ) : null}
          </span>
        </p>
      </div>
      <p
        className={cx(
          'type-number type-subheading shrink-0 text-right',
          cancelled ? 'text-fg-muted line-through' : income ? 'text-positive' : 'text-fg',
        )}
        aria-label={`${typeLabel} de ${formatMoney(transaction.amount, transaction.currency)}`}
      >
        {sign} {formatMoney(transaction.amount, transaction.currency)}
      </p>
    </li>
  )
}
