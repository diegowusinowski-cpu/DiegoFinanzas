import { useState } from 'react'
import { formatMoney, type MinorUnits } from '@/domain'
import { cx } from '../cx'
import { IconButton } from './Button'
import { FlagAR } from './FlagAR'
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
      <h2 id="balance-label" className="sr-only">
        Saldo disponible
      </h2>
      <div className="flex items-center gap-2.5">
        <FlagAR />
        <div className="min-w-0 flex-1">
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
        </div>
        <IconButton
          variant="glass"
          size="sm"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          className="-mr-1.5 size-8 bg-transparent text-on-panel-soft hover:text-on-panel"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size="sm" />
        </IconButton>
      </div>
      <p className="text-body-sm text-on-panel-soft">ARS • Datos de cuenta</p>
    </section>
  )
}
