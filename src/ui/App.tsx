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
import { LucaLoader, LucaMascot } from './luca'
import { MovementFlow } from './flow/MovementFlow'
import { TypeChooserSheet } from './flow/TypeChooserSheet'
import { LoansScreen } from './loans/LoansScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SavingsScreen } from './savings/SavingsScreen'
import { MovementsScreen } from './screens/MovementsScreen'

export function App() {
  const { status, errorMessage } = useAuth()
  if (status === 'loading') return <Splash />
  if (status === 'unavailable') return <ConnectionProblem message={errorMessage} />
  if (status === 'unlocked') {
    return (
      <FinanceProvider>
        <Shell />
      </FinanceProvider>
    )
  }
  return <LoginScreen />
}

/** No hay conexión con el servidor o la base de datos: no se muestra ni se guarda nada hasta que vuelva. */
function ConnectionProblem({ message }: { message: string | null }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-canvas px-gutter">
      <Card className="flex w-full flex-col items-start gap-3 p-6" role="alert">
        <LucaMascot state="error" size="lg" animation="enter" />
        <h1 className="type-title">No pudimos conectar</h1>
        <p className="text-body-sm text-fg-soft">{message}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </Card>
    </main>
  )
}

function Splash() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-canvas" aria-busy="true" aria-label="Cargando DWF">
      {/* Luca camina mientras se abre la app (quieta con movimiento reducido). */}
      <div className="flex flex-col items-center gap-3">
        <LucaLoader label="Cargando" size={88} />
        <Wordmark size="lg" />
      </div>
    </main>
  )
}

function Shell() {
  const { persistent, dataMode } = useServices()
  const { status, errorMessage, reload } = useFinance()
  const [tab, setTab] = useState<Tab>('home')
  const [flowType, setFlowType] = useState<TransactionType | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-canvas pb-28 sm:border-x sm:border-line">
      {!persistent ? (
        <p role="status" className="mx-gutter mt-safe mb-3 rounded-card bg-warning-bg p-4 text-body-sm text-warning">
          Tu navegador no permite guardar datos: los movimientos se perderán al cerrar esta pestaña.
        </p>
      ) : null}

      {dataMode === 'local' ? (
        <p role="status" className="mx-gutter mt-safe mb-3 rounded-card bg-warning-bg p-4 text-body-sm text-warning">
          Modo local: este sitio no tiene base de datos conectada. Lo que cargues se guarda solo en este navegador.
        </p>
      ) : null}

      {status === 'error' ? (
        <Card className="mx-gutter mt-safe flex flex-col items-start gap-3 p-6" role="alert">
          <LucaMascot state="error" size="lg" animation="enter" />
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
      ) : tab === 'loans' ? (
        <LoansScreen onBack={() => setTab('home')} />
      ) : (
        <SavingsScreen onBack={() => setTab('home')} />
      )}

      <BottomNav active={tab} onSelect={setTab} onAdd={() => setChooserOpen(true)} />
      <TypeChooserSheet
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onSelect={(type) => {
          setChooserOpen(false)
          setFlowType(type)
        }}
      />
      {flowType ? <MovementFlow type={flowType} onClose={() => setFlowType(null)} /> : null}
      <ReminderSheet open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </div>
  )
}
