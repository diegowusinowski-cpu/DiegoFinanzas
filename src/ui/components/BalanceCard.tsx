import { useState } from 'react'
import { formatMoney, type MinorUnits } from '@/domain'
import { cx } from '../cx'
import { IconButton } from './Button'
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
        <IconButton
          variant="tertiary"
          size="sm"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          className="text-fg-soft"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size="sm" />
        </IconButton>
      </div>
      {loading ? (
        <Skeleton className="h-14 w-60" />
      ) : (
        <p
          data-testid="balance"
          className={cx(
            'break-words tabular-nums',
            text.length > 13 ? 'type-display' : 'type-display-xl',
            balance < 0 && !hidden && 'text-danger',
          )}
        >
          {text}
        </p>
      )}
    </section>
  )
}
