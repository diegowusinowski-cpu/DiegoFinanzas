import type { ReactNode } from 'react'
import { COUNTRY_INFO, PAYMENT_LABEL, formatLongDate } from '../flow/flowModel'
import { formatMoney, type Category, type Transaction } from '@/domain'
import { cx } from '../cx'
import { IconButton } from '../components/Button'
import { Flag } from '../components/Flags'
import { Icon } from '../components/Icon'
import { FlowFrame } from '../flow/FlowFrame'
import { categoryIcon } from './categoryIcon'
import { STATUS_LABEL } from './statusLabel'

interface MovementDetailProps {
  transaction: Transaction
  category: Category | undefined
  onClose(): void
}

const STATUS_DOT = {
  COMPLETED: 'bg-positive-vivid',
  SCHEDULED: 'bg-warning',
  CANCELLED: 'bg-fg-muted',
} as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 py-1.5">
      <dt className="shrink-0 text-body text-fg-soft">{label}</dt>
      <dd className="type-subheading min-w-0 text-right text-fg">{children}</dd>
    </div>
  )
}

/** Detalle de solo lectura con todo lo guardado durante el flujo de registro. */
export function MovementDetail({ transaction: t, category, onClose }: MovementDetailProps) {
  const income = t.type === 'INCOME'
  const country = COUNTRY_INFO[t.country]
  const amount = formatMoney(t.amount, t.currency)

  return (
    <FlowFrame className="animate-sheet">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del movimiento"
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex min-h-16 shrink-0 items-center justify-end px-gutter pt-safe pb-2">
          <IconButton variant="secondary" size="md" onClick={onClose} aria-label="Cerrar detalle">
            <Icon name="close" />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto px-gutter pb-safe">
          <section className="flex flex-col items-center gap-3 pt-2 pb-8 text-center">
            <span
              className={cx(
                'grid size-[4.5rem] place-items-center rounded-pill',
                income ? 'bg-positive-bg text-positive' : 'bg-sunken text-fg',
              )}
            >
              <Icon name={categoryIcon(t.categoryId, t.type)} size="lg" />
            </span>
            <p
              data-testid="detail-amount"
              className={cx('type-heading type-number mt-2', t.status === 'CANCELLED' && 'text-fg-muted line-through')}
            >
              {income ? '+' : '−'} {amount}
            </p>
            <p className="text-body text-fg-soft">
              {income ? 'Ingreso' : 'Gasto'} · {t.currency}
            </p>
          </section>

          <div className="border-t border-line py-3">
            <p className="text-body-sm text-fg-soft">Concepto</p>
            <p className="type-subheading mt-0.5 text-fg">{t.description}</p>
          </div>

          <dl className="border-t border-line py-2">
            <Row label="Tipo">{income ? 'Ingreso' : 'Gasto'}</Row>
            <Row label="Importe">{amount}</Row>
            <Row label="Moneda">{t.currency}</Row>
            <Row label="Categoría">{category?.name ?? '—'}</Row>
            <Row label="Tipo de operación">{t.paymentMethod ? PAYMENT_LABEL[t.paymentMethod] : '—'}</Row>
            <Row label="País">
              <span className="inline-flex items-center gap-2">
                <Flag country={t.country} size={18} />
                {country.name}
              </span>
            </Row>
          </dl>

          <dl className="border-t border-line py-2">
            <Row label="Fecha">
              {formatLongDate(t.date)}, {t.time}
            </Row>
            <Row label="Estado">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className={cx('size-2.5 rounded-pill', STATUS_DOT[t.status])} />
                {STATUS_LABEL[t.status]}
              </span>
            </Row>
          </dl>
        </div>
      </div>
    </FlowFrame>
  )
}
