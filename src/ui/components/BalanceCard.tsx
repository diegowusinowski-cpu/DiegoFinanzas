import { useState } from 'react'
import { formatMoney, type MinorUnits } from '@/domain'
import { cx } from '../cx'
import { Icon } from './Icon'
import { Skeleton } from './Card'

export function BalanceCard({ balance, loading }: { balance: MinorUnits; loading: boolean }) {
  const [hidden, setHidden] = useState(false)
  const text = hidden ? '$ ••••••' : formatMoney(balance)
  return (
    <section aria-labelledby="balance-label" className="flex flex-col gap-3 pt-3">
      <div className="flex items-center gap-2">
        <h2 id="balance-label" className="type-eyebrow">
          Saldo disponible
        </h2>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          className="grid size-8 place-items-center rounded-pill text-fg-soft transition-colors duration-200 hover:bg-glass hover:text-fg"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size={17} />
        </button>
      </div>
      {loading ? (
        <Skeleton className="h-14 w-60" />
      ) : (
        <p
          data-testid="balance"
          className={cx(
            'break-words tabular-nums',
            text.length > 13 ? 'type-display' : 'type-display-xl',
            balance < 0 && !hidden && 'text-orchid-bloom',
          )}
        >
          {text}
        </p>
      )}
    </section>
  )
}
