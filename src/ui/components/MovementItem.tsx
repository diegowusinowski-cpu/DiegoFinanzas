import { formatMoney, formatRelativeDate, type Category, type Transaction } from '@/domain'
import { cx } from '../cx'
import { Icon } from './Icon'

interface MovementItemProps {
  transaction: Transaction
  category: Category | undefined
  today: string
}

export function MovementItem({ transaction, category, today }: MovementItemProps) {
  const income = transaction.type === 'INCOME'
  const cancelled = transaction.status === 'CANCELLED'
  const scheduled = transaction.status === 'SCHEDULED'
  const sign = income ? '+' : '−'
  const typeLabel = income ? 'Ingreso' : 'Gasto'

  return (
    <li className="flex items-center gap-3.5 py-4">
      <span
        className={cx(
          'grid size-11 shrink-0 place-items-center rounded-pill',
          income ? 'bg-action text-fg-on-action' : 'border border-line bg-glass-strong text-fg',
          cancelled && 'opacity-40',
        )}
      >
        <Icon name={income ? 'arrow-down' : 'arrow-up'} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-body font-medium', cancelled ? 'text-fg-muted line-through' : 'text-fg')}>
          {transaction.description}
        </p>
        <p className="text-caption text-fg-soft">
          {typeLabel} · {formatRelativeDate(transaction.date, today)}, {transaction.time}
          {category ? ` · ${category.name}` : ''}
        </p>
        {scheduled || cancelled ? (
          <span className="mt-1.5 inline-block rounded-pill border border-line bg-glass px-2.5 py-0.5 font-mono text-[0.625rem] tracking-[0.12em] text-fg-soft uppercase">
            {scheduled ? 'Programado' : 'Anulado'}
          </span>
        ) : null}
      </div>
      <p
        className={cx(
          'shrink-0 text-body font-medium tabular-nums',
          cancelled ? 'text-fg-muted line-through' : income ? 'text-fg' : 'text-fg-soft',
        )}
        aria-label={`${typeLabel} de ${formatMoney(transaction.amount)}`}
      >
        {sign} {formatMoney(transaction.amount)}
      </p>
    </li>
  )
}
