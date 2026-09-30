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
    <li className="flex items-center gap-3.5 py-3.5">
      <span
        className={cx(
          'grid size-11 shrink-0 place-items-center rounded-full',
          income ? 'bg-income-bg text-income' : 'bg-expense-bg text-expense',
          cancelled && 'opacity-50',
        )}
      >
        <Icon name={income ? 'arrow-down' : 'arrow-up'} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[0.95rem] font-semibold', cancelled && 'text-muted line-through')}>
          {transaction.description}
        </p>
        <p className="text-[0.8rem] leading-snug text-muted">
          {typeLabel} · {formatRelativeDate(transaction.date, today)}, {transaction.time}
          {category ? ` · ${category.name}` : ''}
        </p>
        {scheduled || cancelled ? (
          <span
            className={cx(
              'mt-1 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-semibold',
              scheduled ? 'bg-warn-bg text-warn' : 'bg-sunken text-muted',
            )}
          >
            {scheduled ? 'Programado' : 'Anulado'}
          </span>
        ) : null}
      </div>
      <p
        className={cx(
          'shrink-0 text-[0.95rem] font-bold tabular-nums',
          cancelled ? 'text-muted line-through' : income ? 'text-income' : 'text-expense',
        )}
        aria-label={`${typeLabel} de ${formatMoney(transaction.amount)}`}
      >
        {sign} {formatMoney(transaction.amount)}
      </p>
    </li>
  )
}
