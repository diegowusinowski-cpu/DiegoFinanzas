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
    <div className="flex flex-col gap-9 animate-rise">
      <header className="flex items-center justify-between pt-safe">
        <Wordmark />
        {profile ? <p className="text-body-sm text-fg-soft">Hola, {profile.displayName}</p> : null}
      </header>

      <BalanceCard balance={finance.balance} loading={loading} />

      <section aria-label="Acciones principales" className="grid grid-cols-2 gap-3">
        <ActionButton tone="secondary" label="Gasto" icon="arrow-up" onClick={() => onNewTransaction('EXPENSE')} disabled={loading} />
        <ActionButton tone="primary" label="Ingreso" icon="arrow-down" onClick={() => onNewTransaction('INCOME')} disabled={loading} />
      </section>

      <section aria-labelledby="reminders-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="reminders-title" className="type-title">
            Recordatorios
          </h2>
          <button
            type="button"
            onClick={onNewReminder}
            className="type-eyebrow interactive min-h-10 shrink-0 whitespace-nowrap rounded-pill px-3 text-fg underline underline-offset-4 hover:bg-glass"
          >
            + Agregar
          </button>
        </div>
        {loading ? (
          <Skeleton className="h-32 rounded-panel" />
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
          <h2 id="latest-title" className="type-title">
            Últimos movimientos
          </h2>
          {finance.history.length > 3 ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="type-eyebrow interactive min-h-10 shrink-0 whitespace-nowrap rounded-pill px-3 text-fg underline underline-offset-4 hover:bg-glass"
            >
              Ver todos
            </button>
          ) : null}
        </div>
        <Card className="px-5 py-1">
          {loading ? (
            <div className="flex flex-col gap-4 py-5" aria-busy="true" aria-label="Cargando movimientos">
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
  tone,
  onClick,
  disabled,
}: {
  label: string
  icon: 'arrow-up' | 'arrow-down'
  tone: 'primary' | 'secondary'
  onClick(): void
  disabled: boolean
}) {
  const primary = tone === 'primary'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`interactive flex min-h-36 flex-col items-start justify-between rounded-panel p-5 text-left ${
        primary
          ? 'bg-action text-on-action hover:bg-action-hover active:bg-action-pressed'
          : 'bg-sunken text-fg hover:bg-sunken-hover active:bg-sunken-hover'
      }`}
    >
      <span
        className={`grid size-11 place-items-center rounded-pill ${primary ? 'bg-glass-on-panel text-on-action' : 'bg-fg text-canvas'}`}
      >
        <Icon name={icon} />
      </span>
      <span className="type-heading text-current">{label}</span>
    </button>
  )
}
