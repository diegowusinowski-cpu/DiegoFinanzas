import { useAuth } from '@/state/AuthContext'
import { useFinance } from '@/state/FinanceContext'
import type { TransactionType } from '@/domain'
import { BalanceCard } from '../components/BalanceCard'
import { LogoDiegoFinanzas } from '../brand/LogoDiegoFinanzas'
import { BrandFooter } from '../components/Brand'
import { Button } from '../components/Button'
import { EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { MovementItem } from '../components/MovementItem'
import { RatesCard } from '../components/RatesCard'
import { ReminderCard } from '../components/ReminderCards'
import { SectionAction, SectionHeader } from '../components/SectionHeader'
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
    <div className="animate-rise">
      {/* Superficie financiera: identidad, saldo y acciones principales. */}
      <section className="bg-panel-texture px-gutter pt-safe pb-9 text-on-panel">
        <header className="flex min-h-control-md items-center justify-between">
          <LogoDiegoFinanzas size="sm" className="text-on-panel" />
          {profile ? (
            <p className="rounded-pill bg-glass-on-panel px-3.5 py-2 text-body-sm leading-none font-medium text-on-panel">
              Hola, {profile.displayName}
            </p>
          ) : null}
        </header>

        <div className="mt-8 flex flex-col gap-6">
          <BalanceCard balance={finance.balance} loading={loading} />

          <section aria-label="Acciones principales" className="grid grid-cols-2 gap-2.5">
            <Button variant="inverse" disabled={loading} onClick={() => onNewTransaction('INCOME')}>
              <Icon name="arrow-down" />
              Ingreso
            </Button>
            <Button variant="glass" disabled={loading} onClick={() => onNewTransaction('EXPENSE')}>
              <Icon name="arrow-up" />
              Gasto
            </Button>
          </section>
        </div>
      </section>

      {/* Hoja clara que sube sobre la superficie financiera. */}
      <div className="relative -mt-5 flex flex-col gap-section rounded-t-sheet bg-canvas px-gutter pt-5">
        <section aria-labelledby="reminders-title" className="flex flex-col gap-block">
          <SectionHeader
            id="reminders-title"
            title="Recordatorios"
            action={<SectionAction onClick={onNewReminder}>+ Agregar</SectionAction>}
          />
          {loading ? (
            <Skeleton className="h-14" />
          ) : finance.reminders.length === 0 ? (
            <EmptyState icon="bell" title="Sin recordatorios">
              Acá vas a ver tus próximos vencimientos y cobros.
            </EmptyState>
          ) : (
            <ul>
              {finance.reminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  today={finance.today}
                  onDismiss={(id) => void finance.dismissReminder(id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="latest-title" className="flex flex-col gap-block">
          <SectionHeader
            id="latest-title"
            title="Últimos movimientos"
            action={finance.history.length > 3 ? <SectionAction onClick={onSeeAll}>Ver todos</SectionAction> : null}
          />
          {loading ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando movimientos">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : finance.latest.length === 0 ? (
            <EmptyState icon="list" title="Todavía no hay movimientos">
              Registrá tu primer ingreso o gasto y va a aparecer acá.
            </EmptyState>
          ) : (
            <ul data-testid="latest-movements">
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
        </section>

        <RatesCard state={rateState} onRefresh={refresh} />

        <BrandFooter />
      </div>
    </div>
  )
}
