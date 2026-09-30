import { useState } from 'react'
import type { TransactionType } from '@/domain'
import { useAuth } from '@/state/AuthContext'
import { FinanceProvider, useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { BottomNav, type Tab } from './components/BottomNav'
import { Wordmark } from './components/Brand'
import { Button } from './components/Button'
import { Card } from './components/Card'
import { ReminderSheet } from './components/ReminderSheet'
import { MovementFlow } from './flow/MovementFlow'
import { LoansSection } from './loans/LoansSection'
import { DashboardScreen } from './screens/DashboardScreen'
import { LoginScreen } from './screens/LoginScreen'
import { MoreScreen } from './screens/MoreScreen'
import { MovementsScreen } from './screens/MovementsScreen'

export function App() {
  const { status } = useAuth()
  if (status === 'loading') return <Splash />
  if (status === 'unlocked') {
    return (
      <FinanceProvider>
        <Shell />
      </FinanceProvider>
    )
  }
  return <LoginScreen />
}

function Splash() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-canvas" aria-busy="true" aria-label="Cargando DWF">
      <Wordmark size="lg" className="animate-pulse" />
    </main>
  )
}

function Shell() {
  const { persistent } = useServices()
  const { status, errorMessage, reload } = useFinance()
  const [tab, setTab] = useState<Tab>('home')
  const [flowType, setFlowType] = useState<TransactionType | null>(null)
  const [loansOpen, setLoansOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-canvas pb-28 sm:border-x sm:border-line">
      {!persistent ? (
        <p role="status" className="mx-gutter mt-safe mb-3 rounded-card bg-warning-bg p-4 text-body-sm text-warning">
          Tu navegador no permite guardar datos: los movimientos se perderán al cerrar esta pestaña.
        </p>
      ) : null}

      {status === 'error' ? (
        <Card className="mx-gutter mt-safe flex flex-col items-start gap-3 p-6" role="alert">
          <h1 className="type-title">No pudimos cargar tus datos</h1>
          <p className="text-body-sm text-fg-soft">{errorMessage}</p>
          <Button onClick={reload}>Reintentar</Button>
        </Card>
      ) : tab === 'home' ? (
        <DashboardScreen
          onNewTransaction={setFlowType}
          onNewReminder={() => setReminderOpen(true)}
          onSeeAll={() => setTab('movements')}
        />
      ) : tab === 'movements' ? (
        <MovementsScreen onBack={() => setTab('home')} />
      ) : (
        <MoreScreen />
      )}

      <BottomNav active={tab} onSelect={setTab} onAdd={() => setLoansOpen(true)} />
      {loansOpen ? <LoansSection onClose={() => setLoansOpen(false)} /> : null}
      {flowType ? <MovementFlow type={flowType} onClose={() => setFlowType(null)} /> : null}
      <ReminderSheet open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </div>
  )
}
