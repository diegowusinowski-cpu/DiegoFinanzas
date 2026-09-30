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
import { TransactionSheet } from './components/TransactionSheet'
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
    <main className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Cargando DWF">
      <Wordmark className="animate-pulse text-5xl" />
    </main>
  )
}

function Shell() {
  const { persistent } = useServices()
  const { status, errorMessage, reload } = useFinance()
  const [tab, setTab] = useState<Tab>('home')
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  // Conserva el último tipo mientras la hoja se cierra, para evitar un salto visual.
  const [lastType, setLastType] = useState<TransactionType>('EXPENSE')

  const openTransaction = (type: TransactionType) => {
    setLastType(type)
    setTransactionType(type)
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-5 pb-36">
      {!persistent ? (
        <p role="status" className="mt-safe mb-3 rounded-2xl bg-warn-bg p-3 text-sm font-medium text-warn">
          Tu navegador no permite guardar datos: los movimientos se perderán al cerrar esta pestaña.
        </p>
      ) : null}

      {status === 'error' ? (
        <Card className="mt-safe flex flex-col items-start gap-3 p-6" role="alert">
          <h1 className="text-xl font-bold">No pudimos cargar tus datos</h1>
          <p className="text-sm text-ink-soft">{errorMessage}</p>
          <Button onClick={reload}>Reintentar</Button>
        </Card>
      ) : tab === 'home' ? (
        <DashboardScreen
          onNewTransaction={openTransaction}
          onNewReminder={() => setReminderOpen(true)}
          onSeeAll={() => setTab('movements')}
        />
      ) : tab === 'movements' ? (
        <MovementsScreen />
      ) : (
        <MoreScreen />
      )}

      <BottomNav active={tab} onSelect={setTab} onAdd={() => openTransaction(lastType)} />
      <TransactionSheet
        open={transactionType !== null}
        initialType={transactionType ?? lastType}
        onClose={() => setTransactionType(null)}
      />
      <ReminderSheet open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </div>
  )
}
