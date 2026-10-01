import { useState, type ReactNode } from 'react'
import {
  FREQUENCY_LABEL,
  FREQUENCY_UNIT,
  contributionsOf,
  formatLoanDate,
  formatMoney,
  jarSummary,
  sortContributions,
  type SavingsJar,
} from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { FlowFrame } from '../flow/FlowFrame'
import { LucaMascot, jarLuca } from '../luca'
import { AddMoneyFlow } from './AddMoneyFlow'
import { JarIllustration } from './JarIllustration'

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 py-1.5">
      <dt className="shrink-0 text-body text-fg-soft">{label}</dt>
      <dd className="type-subheading min-w-0 text-right text-fg" {...(testId ? { 'data-testid': testId } : {})}>
        {children}
      </dd>
    </div>
  )
}

/** Detalle de un frasco: progreso grande, datos, plan, próximo aporte e historial de aportes. */
export function JarDetail({ jar, onClose }: { jar: SavingsJar; onClose(): void }) {
  const { contributions, today } = useFinance()
  const [adding, setAdding] = useState(false)
  const own = sortContributions(contributionsOf(jar.id, contributions))
  const summary = jarSummary(jar, contributions, today)
  const unit = FREQUENCY_UNIT[jar.plan.frequency]

  return (
    <>
      <FlowFrame className="animate-sheet">
        <div role="dialog" aria-modal="true" aria-label="Detalle del frasco" className="flex min-h-0 flex-1 flex-col">
          <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-gutter pt-safe pb-2">
            <div className="min-w-0">
              <h1 className="type-heading truncate">{jar.name}</h1>
              <p className="text-body-sm text-fg-soft">Frasco de ahorro</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Meta cumplida: Luca celebra con el trofeo; antes, acompaña con la alcancía. */}
              <LucaMascot
                state={jarLuca(summary.completed)}
                size="sm"
                animation={summary.completed ? 'celebrate' : 'enter'}
              />
            <IconButton variant="secondary" size="md" onClick={onClose} aria-label="Cerrar detalle">
              <Icon name="close" />
            </IconButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-4">
            <section className="mt-2 flex flex-col items-center rounded-panel bg-panel p-5 text-on-panel">
              <JarIllustration
                ratio={summary.ratio}
                label={`Frasco al ${summary.percent}%`}
                className="h-44 w-36"
              />
              <p className="type-money mt-3" data-testid="jar-percent">
                {summary.percent}%
              </p>
              <p className="text-body-sm text-on-panel-soft">
                {summary.completed ? '¡Objetivo cumplido!' : `${formatMoney(summary.saved)} de ${formatMoney(jar.targetAmount)}`}
              </p>
              <div
                role="progressbar"
                aria-label="Progreso del frasco"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.percent}
                className="mt-4 h-1.5 w-full overflow-hidden rounded-pill bg-glass-on-panel"
              >
                <div className="h-full rounded-pill bg-positive-vivid" style={{ width: `${summary.ratio * 100}%` }} />
              </div>
            </section>

            <dl className="mt-3 py-2">
              <Row label="Objetivo" testId="jar-target">
                {formatMoney(jar.targetAmount)}
              </Row>
              <Row label="Ahorrado" testId="jar-saved">
                {formatMoney(summary.saved)}
              </Row>
              <Row label="Falta" testId="jar-remaining">
                {formatMoney(summary.remaining)}
              </Row>
              <Row label="Porcentaje">{summary.percent}%</Row>
              <Row label="Plan configurado" testId="jar-plan">
                {FREQUENCY_LABEL[jar.plan.frequency]} · {formatMoney(jar.plan.amount)}
              </Row>
              <Row label={`Recomendado por ${unit}`} testId="jar-recommended">
                {formatMoney(summary.recommended)}
              </Row>
              <Row label="Próximo aporte" testId="jar-next">
                {summary.nextDate ? formatLoanDate(summary.nextDate) : 'Sin aportes pendientes'}
              </Row>
              {summary.nextDate ? (
                <Row label="Monto del próximo aporte" testId="jar-next-amount">
                  {formatMoney(summary.nextAmount)}
                </Row>
              ) : null}
              {jar.targetDate ? <Row label="Fecha objetivo">{formatLoanDate(jar.targetDate)}</Row> : null}
            </dl>

            <section aria-labelledby="contributions-title" className="mt-4">
              <h2 id="contributions-title" className="type-title mb-1">
                Historial de aportes
              </h2>
              {own.length === 0 ? (
                <p className="py-3 text-body text-fg-soft">Todavía no agregaste dinero a este frasco.</p>
              ) : (
                <ul>
                  {own.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
                    >
                      <span className="text-body text-fg-soft">{formatLoanDate(c.date)}</span>
                      <span className="type-subheading text-fg">+ {formatMoney(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="shrink-0 px-gutter pt-2 pb-safe">
            <Button block size="lg" onClick={() => setAdding(true)}>
              <Icon name="plus" />
              Agregar dinero
            </Button>
          </div>
        </div>
      </FlowFrame>
      {adding ? <AddMoneyFlow jar={jar} onClose={() => setAdding(false)} /> : null}
    </>
  )
}
