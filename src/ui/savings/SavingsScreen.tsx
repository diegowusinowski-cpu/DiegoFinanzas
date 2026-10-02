import { useState } from 'react'
import { formatMoney } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { cx } from '../cx'
import { EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { FlowHeader } from '../flow/FlowFrame'
import { JarDetail } from './JarDetail'
import { JarRow } from './JarRow'
import { NewJarFlow } from './NewJarFlow'

type View = { name: 'list' } | { name: 'new' } | { name: 'detail'; id: string }

/**
 * Ahorros: sección principal con frascos. Muestra el saldo total, cuánto está reservado en frascos y
 * cuánto queda disponible. Ahorrar solo reserva dinero: el saldo total no cambia.
 */
export function SavingsScreen({ onBack }: { onBack(): void }) {
  const { jars, contributions, savings, status, today } = useFinance()
  const [view, setView] = useState<View>({ name: 'list' })
  const toList = () => setView({ name: 'list' })
  const loading = status === 'loading'
  const current = view.name === 'detail' ? jars.find((j) => j.id === view.id) : undefined
  const balanceText = formatMoney(savings.balance)

  return (
    <>
      <div className="animate-rise">
        <div className="sticky top-0 z-10 bg-canvas">
          <FlowHeader onBack={onBack} backLabel="Volver al inicio" title="Ahorros" heading />
        </div>

        <div className="flex flex-col gap-section px-gutter pt-1">
          <section aria-label="Resumen de ahorros" className="rounded-panel bg-panel p-5 text-on-panel">
            <p className="text-body-sm text-on-panel-soft">Saldo total</p>
            {loading ? (
              <Skeleton className="mt-2 h-11 w-52 bg-glass-on-panel" />
            ) : (
              <p
                className={cx(balanceText.length > 13 ? 'type-money-sm' : 'type-money', 'mt-1 break-words')}
                data-testid="savings-balance"
              >
                {balanceText}
              </p>
            )}
            <dl className="mt-4 flex flex-col">
              <SummaryRow label="En frascos" value={formatMoney(savings.assigned)} testId="savings-assigned" />
              <SummaryRow
                label="Disponible no asignado"
                value={formatMoney(savings.available)}
                testId="savings-available"
                negative={savings.available < 0}
              />
            </dl>
          </section>

          <ul aria-label="Acciones de ahorros">
            <OptionRow
              leading={<Icon name="plus" />}
              title="Nuevo frasco"
              subtitle="Separá dinero para un objetivo"
              onClick={() => setView({ name: 'new' })}
            />
          </ul>

          <section aria-labelledby="jars-title" className="flex flex-col gap-2">
            <h2 id="jars-title" className="type-title">
              Mis frascos
            </h2>
            {loading ? (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando frascos">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : jars.length === 0 ? (
              <EmptyState icon="jar" title="Todavía no hay frascos">
                Creá uno para separar dinero hacia un objetivo.
              </EmptyState>
            ) : (
              <ul>
                {jars.map((jar) => (
                  <JarRow
                    key={jar.id}
                    jar={jar}
                    contributions={contributions}
                    today={today}
                    onOpen={(j) => setView({ name: 'detail', id: j.id })}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Fuera del contenedor animado: sus capas fijas deben cubrir toda la pantalla. */}
      {view.name === 'new' ? (
        <NewJarFlow onClose={toList} onCreated={(jar) => setView({ name: 'detail', id: jar.id })} />
      ) : null}
      {view.name === 'detail' && current ? <JarDetail jar={current} onClose={toList} /> : null}
    </>
  )
}

function SummaryRow({
  label,
  value,
  testId,
  negative = false,
}: {
  label: string
  value: string
  testId: string
  negative?: boolean
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-t border-glass-on-panel">
      <dt className="text-body-sm text-on-panel-soft">{label}</dt>
      <dd
        className={cx('type-subheading min-w-0 text-right', negative ? 'text-danger-on-panel' : 'text-on-panel')}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  )
}
