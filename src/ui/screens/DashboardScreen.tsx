import { useAuth } from '@/state/AuthContext'
import { useFinance } from '@/state/FinanceContext'
import type { TransactionType } from '@/domain'
import { BalanceCard } from '../components/BalanceCard'
import { BrandFooter, Wordmark } from '../components/Brand'
import { Card, EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { MovementItem } from '../components/MovementItem'
import { RatesCard } from '../components/RatesCard'
import { ReminderCard } from '../components/ReminderCards'
import { useUsdBlueRate } from '../hooks/useExchangeRate'

interface DashboardProps {
  onNewTransaction(type: TransactionType): void
  onNewReminder(): void
  onSeeAll(): void
}

export function DashboardScreen({ onNewTransaction, onNewReminder, onSeeAll }: DashboardProps) {
  const { profile } = useAuth()
  const finance = useFinance()
  const { state: rateState, refresh } = useUsdBlueRate()
  const loading = finance.status === 'loading'

  return (
    <div className="flex flex-col gap-7 animate-rise">
      <header className="flex items-center justify-between pt-safe">
        <Wordmark />
        {profile ? <p className="text-sm font-medium text-muted">Hola, {profile.displayName}</p> : null}
      </header>

      <BalanceCard balance={finance.balance} loading={loading} />

      <section aria-label="Acciones principales" className="grid grid-cols-2 gap-3">
        <ActionButton label="Gasto" icon="arrow-up" onClick={() => onNewTransaction('EXPENSE')} disabled={loading} />
        <ActionButton label="Ingreso" icon="arrow-down" onClick={() => onNewTransaction('INCOME')} disabled={loading} />
      </section>

      <section aria-labelledby="reminders-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="reminders-title" className="text-lg font-bold tracking-tight">
            Recordatorios
          </h2>
          <button
            type="button"
            onClick={onNewReminder}
            className="min-h-10 rounded-full px-3 text-sm font-semibold text-ink underline underline-offset-4"
          >
            + Agregar
          </button>
        </div>
        {loading ? (
          <Skeleton className="h-28 rounded-card" />
        ) : finance.reminders.length === 0 ? (
          <Card>
            <EmptyState icon="bell" title="Sin recordatorios">
              Acá vas a ver tus próximos vencimientos y cobros.
            </EmptyState>
          </Card>
        ) : (
          <ul className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
            {finance.reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                today={finance.today}
                single={finance.reminders.length === 1}
                onDismiss={(id) => void finance.dismissReminder(id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="latest-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="latest-title" className="text-lg font-bold tracking-tight">
            Últimos movimientos
          </h2>
          {finance.history.length > 3 ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="min-h-10 rounded-full px-3 text-sm font-semibold text-ink underline underline-offset-4"
            >
              Ver todos
            </button>
          ) : null}
        </div>
        <Card className="px-5 py-1.5">
          {loading ? (
            <div className="flex flex-col gap-4 py-4" aria-busy="true" aria-label="Cargando movimientos">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : finance.latest.length === 0 ? (
            <EmptyState icon="list" title="Todavía no hay movimientos">
              Registrá tu primer ingreso o gasto y va a aparecer acá.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line" data-testid="latest-movements">
              {finance.latest.map((t) => (
                <MovementItem
                  key={t.id}
                  transaction={t}
                  category={finance.categories.find((c) => c.id === t.categoryId)}
                  today={finance.today}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <RatesCard state={rateState} onRefresh={refresh} />

      <BrandFooter />
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: 'arrow-up' | 'arrow-down'
  onClick(): void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-24 flex-col items-start justify-between rounded-card bg-surface p-4 text-left shadow-card transition duration-150 hover:bg-white/60 active:scale-[0.97] disabled:opacity-50"
    >
      <span className="grid size-10 place-items-center rounded-full bg-ink text-white">
        <Icon name={icon} size={20} />
      </span>
      <span className="text-lg font-bold tracking-tight">{label}</span>
    </button>
  )
}

