import { useState } from 'react'
import { formatMoney, type MinorUnits } from '@/domain'
import { Icon } from './Icon'
import { Skeleton } from './Card'

export function BalanceCard({ balance, loading }: { balance: MinorUnits; loading: boolean }) {
  const [hidden, setHidden] = useState(false)
  return (
    <section aria-labelledby="balance-label" className="flex flex-col gap-1 pt-2">
      <div className="flex items-center gap-2">
        <h2 id="balance-label" className="text-sm font-semibold text-muted">
          Saldo disponible
        </h2>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-sunken"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {loading ? (
        <Skeleton className="h-12 w-56" />
      ) : (
        <p
          data-testid="balance"
          className={`text-[2.6rem] leading-none font-extrabold tracking-tight tabular-nums ${balance < 0 ? 'text-expense' : 'text-ink'}`}
        >
          {hidden ? '$ ••••••' : formatMoney(balance)}
        </p>
      )}
    </section>
  )
}
