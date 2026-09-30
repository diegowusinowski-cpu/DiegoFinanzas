import { formatMoney, formatRelativeDate, type Transaction } from '@/domain'
import { cx } from '../cx'
import { Icon } from '../components/Icon'
import { categoryIcon } from './categoryIcon'
import { STATUS_LABEL } from './statusLabel'

interface MovementRowProps {
  transaction: Transaction
  today: string
  onOpen(transaction: Transaction): void
}

/**
 * Fila tocable del listado: ícono de la categoría, concepto, fecha (y estado si
 * no está completado) a la izquierda; importe con signo y moneda a la derecha.
 */
export function MovementRow({ transaction, today, onOpen }: MovementRowProps) {
  const income = transaction.type === 'INCOME'
  const cancelled = transaction.status === 'CANCELLED'
  const sign = income ? '+' : '−'
  const amount = formatMoney(transaction.amount, transaction.currency)
  const typeLabel = income ? 'Ingreso' : 'Gasto'

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(transaction)}
        aria-label={`${transaction.description}, ${typeLabel} de ${amount}. Ver detalle`}
        className="interactive -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-card px-2 py-2.5 text-left hover:bg-glass active:bg-glass-strong"
      >
        <span
          className={cx(
            'grid size-avatar shrink-0 place-items-center rounded-pill',
            income ? 'bg-positive-bg text-positive' : 'bg-sunken text-fg',
            cancelled && 'opacity-40',
          )}
        >
          <Icon name={categoryIcon(transaction.categoryId, transaction.type)} />
        </span>

        <span className="min-w-0 flex-1">
          <span className={cx('type-subheading block truncate', cancelled ? 'text-fg-muted line-through' : 'text-fg')}>
            {transaction.description}
          </span>
          <span className="block truncate text-body-sm text-fg-soft">
            {formatRelativeDate(transaction.date, today)}, {transaction.time}
            {transaction.status !== 'COMPLETED' ? (
              <span className="ml-1.5 rounded-chip bg-sunken px-1.5 py-0.5 text-caption font-medium">
                {STATUS_LABEL[transaction.status]}
              </span>
            ) : null}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cx(
              'type-number-row block',
              cancelled ? 'text-fg-muted line-through' : income ? 'text-positive' : 'text-fg',
            )}
          >
            {sign} {amount}
          </span>
          <span className="block text-caption text-fg-soft">{transaction.currency}</span>
        </span>
      </button>
    </li>
  )
}
