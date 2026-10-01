import { useEffect, useState } from 'react'
import { useAuth } from '@/state/AuthContext'
import { useFinance } from '@/state/FinanceContext'
import { latestServices, type TransactionType } from '@/domain'
import { BalanceCarousel } from '../components/BalanceCarousel'
import { Wordmark } from '../components/Brand'
import { Button } from '../components/Button'
import { EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { MovementItem } from '../components/MovementItem'
import { UsdBalanceSheet } from '../components/UsdBalanceSheet'
import { ReminderCard } from '../components/ReminderCards'
import { SectionAction, SectionHeader } from '../components/SectionHeader'
import { ServiceItem } from '../components/ServiceItem'
import { LucaMascot, homeLuca, preloadLuca, remindersLuca, useLucaGreeting } from '../luca'
import { useUsdBlueRate } from '../hooks/useExchangeRate'

const LATEST_SERVICES_LIMIT = 4

interface DashboardProps {
  onNewTransaction(type: TransactionType): void
  onNewReminder(): void
  onSeeAll(): void
}

export function DashboardScreen({ onNewTransaction, onNewReminder, onSeeAll }: DashboardProps) {
  const { profile } = useAuth()
  const finance = useFinance()
  const { state: rateState } = useUsdBlueRate()
  const loading = finance.status === 'loading'
  const [usdOpen, setUsdOpen] = useState(false)
  const reminderLuca = remindersLuca(finance.reminders.length)
  const greeting = useLucaGreeting()
  // Con calma, y sin bloquear nada: las poses que Luca va a necesitar enseguida.
  useEffect(() => preloadLuca(['happy', 'thinking', 'celebrating', 'success', 'spending', 'attentive']), [])
  const services = latestServices(finance.transactions, finance.categories, LATEST_SERVICES_LIMIT)

  return (
    <>
    <div className="animate-rise">
      {/* Superficie financiera: identidad, saldo y acciones principales. */}
      <section className="bg-panel-texture px-gutter pt-safe pb-9 text-on-panel">
        <header className="flex min-h-control-md items-center justify-between">
          <Wordmark className="text-on-panel" />
          <div className="flex items-center gap-2">
            {/* Luca junto al saludo, sobre un fondo claro para que resalte en el verde. Cambia de gesto según la cuenta. */}
            <LucaMascot
              variant={greeting ? 'waving' : loading ? 'walking' : homeLuca(finance.balance)}
              size="sm"
              chip
              priority
              label="Luca, tu compañera de DWF"
            />
            {profile ? (
              <p className="rounded-pill bg-glass-on-panel px-3.5 py-2 text-body-sm leading-none font-medium text-on-panel">
                Hola, {profile.displayName}
              </p>
            ) : null}
          </div>
        </header>

        <div className="mt-8 flex flex-col gap-6">
          <BalanceCarousel
            ars={finance.balance}
            usd={finance.usdBalance}
            loading={loading}
            rate={rateState}
            today={finance.today}
            onEditUsd={() => setUsdOpen(true)}
          />

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
            action={
              <span className="flex items-center gap-1">
                <LucaMascot variant={reminderLuca ?? 'attentive'} size="xs" show={reminderLuca !== null} />
                <SectionAction onClick={onNewReminder}>+ Agregar</SectionAction>
              </span>
            }
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

        <section aria-labelledby="services-title" className="flex flex-col gap-block pb-2">
          <SectionHeader id="services-title" title="Últimos servicios" />
          {loading ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando servicios">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState icon="subscription" title="Sin gastos de servicios">
              Tus gastos en SUBE, Mercado Libre, Claro, Uber, Netflix o Spotify van a aparecer acá.
            </EmptyState>
          ) : (
            <ul data-testid="latest-services">
              {services.map((service) => (
                <ServiceItem key={service.transaction.id} service={service} today={finance.today} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>

      {/* Fuera del contenedor animado: la hoja fija debe cubrir toda la pantalla. */}
      <UsdBalanceSheet
        open={usdOpen}
        current={finance.usdBalance}
        onClose={() => setUsdOpen(false)}
        onSave={async (amount) => {
          const result = await finance.setUsdBalance(amount)
          return result.ok ? null : (result.error.message ?? 'No se pudo guardar.')
        }}
      />
    </>
  )
}
