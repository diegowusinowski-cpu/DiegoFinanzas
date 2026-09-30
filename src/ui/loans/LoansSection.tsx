import { useState } from 'react'
import { installmentsOf, type Loan } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { EmptyState } from '../components/Card'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { FlowFrame, FlowHeader } from '../flow/FlowFrame'
import { LoanCalculator } from './LoanCalculator'
import { LoanCard } from './LoanCard'
import { LoanDetail } from './LoanDetail'
import { NewLoanFlow } from './NewLoanFlow'
import { ReceiptScreen } from './ReceiptScreen'

type View = { name: 'list' } | { name: 'calculator' } | { name: 'new' } | { name: 'detail'; id: string } | { name: 'receipt'; id: string }

/**
 * Sección Préstamos (se abre con el "+"): calculadora, nuevo préstamo y la lista
 * "Mis préstamos". Los préstamos persisten igual que los movimientos.
 */
export function LoansSection({ onClose }: { onClose(): void }) {
  const { loans, installments, status } = useFinance()
  const [view, setView] = useState<View>({ name: 'list' })
  const toList = () => setView({ name: 'list' })

  const current: Loan | undefined =
    view.name === 'detail' || view.name === 'receipt' ? loans.find((l) => l.id === view.id) : undefined

  return (
    <>
      <FlowFrame>
        <FlowHeader onBack={onClose} backLabel="Cerrar préstamos" title="Préstamos" heading />
        <main className="min-h-0 flex-1 overflow-y-auto px-gutter pt-3 pb-safe">
          <ul>
            <OptionRow
              leading={<Icon name="plus" />}
              title="Nuevo préstamo"
              subtitle="Registrá un préstamo con interés fijo del 70%"
              onClick={() => setView({ name: 'new' })}
            />
            <OptionRow
              leading={<Icon name="calculator" />}
              title="Calculadora financiera"
              subtitle="Simulá el interés, el total y las cuotas"
              onClick={() => setView({ name: 'calculator' })}
            />
          </ul>

          <section aria-labelledby="my-loans-title" className="mt-8">
            <h2 id="my-loans-title" className="type-title mb-3">
              Mis préstamos
            </h2>
            {status === 'loading' ? null : loans.length === 0 ? (
              <EmptyState icon="loan" title="Todavía no hay préstamos">
                Cuando crees uno, vas a verlo acá con sus cuotas.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-3">
                {loans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    installments={installmentsOf(loan.id, installments)}
                    onOpen={(l) => setView({ name: 'detail', id: l.id })}
                  />
                ))}
              </ul>
            )}
          </section>
        </main>
      </FlowFrame>

      {view.name === 'calculator' ? <LoanCalculator onClose={toList} /> : null}
      {view.name === 'new' ? <NewLoanFlow onClose={toList} /> : null}
      {view.name === 'detail' && current ? (
        <LoanDetail
          loan={current}
          installments={installmentsOf(current.id, installments)}
          onOpenReceipt={() => setView({ name: 'receipt', id: current.id })}
          onClose={toList}
        />
      ) : null}
      {view.name === 'receipt' && current ? (
        <ReceiptScreen loan={current} mode="view" onClose={() => setView({ name: 'detail', id: current.id })} />
      ) : null}
    </>
  )
}
