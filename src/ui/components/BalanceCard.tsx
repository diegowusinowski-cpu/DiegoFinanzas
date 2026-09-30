import { useState } from 'react'
import { formatMoney, type MinorUnits } from '@/domain'
import { cx } from '../cx'
import { IconButton } from './Button'
import { Icon } from './Icon'
import { Skeleton } from './Card'

/** `$ 7.199,50` → [`$ 7.199`, `,50`]: los centavos se muestran en tamaño menor. */
function splitCents(formatted: string): [string, string] {
  const at = formatted.lastIndexOf(',')
  return at === -1 ? [formatted, ''] : [formatted.slice(0, at), formatted.slice(at)]
}

/** Saldo sobre la superficie financiera oscura del home. */
export function BalanceCard({ balance, loading }: { balance: MinorUnits; loading: boolean }) {
  const [hidden, setHidden] = useState(false)
  const text = hidden ? '$ ••••••' : formatMoney(balance)
  const [whole, cents] = splitCents(text)
  return (
    <section aria-labelledby="balance-label" className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <h2 id="balance-label" className="type-eyebrow text-on-panel-soft">
          Saldo disponible
        </h2>
        <IconButton
          variant="glass"
          size="sm"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          className="size-8 bg-transparent text-on-panel-soft hover:text-on-panel"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size="sm" />
        </IconButton>
      </div>
      {loading ? (
        <Skeleton className="h-11 w-52 bg-glass-on-panel" />
      ) : (
        <p
          data-testid="balance"
          className={cx(
            'break-words',
            text.length > 13 ? 'type-money-sm' : 'type-money',
            balance < 0 && !hidden ? 'text-danger-on-panel' : 'text-on-panel',
          )}
        >
          {whole}
          {cents ? <span className="type-money-cents">{cents}</span> : null}
        </p>
      )}
    </section>
  )
}
