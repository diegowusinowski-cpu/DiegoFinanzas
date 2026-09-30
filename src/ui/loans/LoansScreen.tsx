import { useState } from 'react'
import { installmentsOf, formatMoney, loansSummary, type Loan } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { FlowHeader } from '../flow/FlowFrame'
import { LoanCalculator } from './LoanCalculator'
import { LoanDetail } from './LoanDetail'
import { LoanRow } from './LoanRow'
import { NewLoanFlow } from './NewLoanFlow'
import { ReceiptScreen } from './ReceiptScreen'

type View =
  | { name: 'list' }
  | { name: 'calculator' }
  | { name: 'new' }
  | { name: 'detail'; id: string }
  | { name: 'receipt'; id: string }

/**
 * Préstamos: sección principal de la barra inferior. Resumen, acciones (nuevo préstamo y calculadora)
 * y listado. Los préstamos persisten igual que los movimientos.
 */
export function LoansScreen({ onBack }: { onBack(): void }) {
  const { loans, installments, status, today } = useFinance()
  const [view, setView] = useState<View>({ name: 'list' })
  const toList = () => setView({ name: 'list' })

  const loading = status === 'loading'
  const summary = loansSummary(loans, installments, today)
  const lent = formatMoney(summary.totalLent)
  const current: Loan | undefined =
    view.name === 'detail' || view.name === 'receipt' ? loans.find((l) => l.id === view.id) : undefined

  return (
    <>
      <div className="animate-rise">
        <div className="sticky top-0 z-10 bg-canvas">
          <FlowHeader onBack={onBack} backLabel="Volver al inicio" title="Préstamos" heading />
        </div>

        <div className="flex flex-col gap-section px-gutter pt-1">
          <section aria-label="Resumen de préstamos" className="rounded-panel bg-panel p-5 text-on-panel">
            <p className="text-body-sm text-on-panel-soft">Total prestado</p>
            {loading ? (
              <Skeleton className="mt-2 h-11 w-52 bg-glass-on-panel" />
            ) : (
              <p
                className={`${lent.length > 13 ? 'type-money-sm' : 'type-money'} mt-1 break-words`}
                data-testid="loans-total-lent"
              >
                {lent}
              </p>
            )}
            <dl className="mt-4 flex flex-col">
              <SummaryRow label="Total cobrado" value={formatMoney(summary.totalCollected)} testId="loans-total-collected" />
              <SummaryRow label="Total pendiente" value={formatMoney(summary.totalPending)} testId="loans-total-pending" />
              <SummaryRow label="Préstamos vencidos" value={String(summary.overdueCount)} testId="loans-overdue-count" />
            </dl>
          </section>

          <ul aria-label="Acciones de préstamos">
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

          <section aria-labelledby="my-loans-title" className="flex flex-col gap-2">
            <h2 id="my-loans-title" className="type-title">
              Mis préstamos
            </h2>
            {loading ? (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando préstamos">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : loans.length === 0 ? (
              <EmptyState icon="loan" title="Todavía no hay préstamos">
                Cuando crees uno, vas a verlo acá con sus cuotas.
              </EmptyState>
            ) : (
              <ul>
                {loans.map((loan) => (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    installments={installmentsOf(loan.id, installments)}
                    today={today}
                    onOpen={(l) => setView({ name: 'detail', id: l.id })}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Fuera del contenedor animado: sus capas fijas deben cubrir toda la pantalla. */}
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

function SummaryRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-t border-glass-on-panel">
      <dt className="text-body-sm text-on-panel-soft">{label}</dt>
      <dd className="type-subheading min-w-0 text-right text-on-panel" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}
