import { Card, Skeleton } from './Card'
import { Icon } from './Icon'
import type { RateState } from '../hooks/useExchangeRate'
import { Button } from './Button'

const rateFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const updatedFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const formatRate = (value: number) => rateFormatter.format(value).replace(/\u00a0/g, ' ')

export function RatesCard({ state, onRefresh }: { state: RateState; onRefresh(): void }) {
  return (
    <section aria-labelledby="rates-title" className="flex flex-col gap-3">
      <h2 id="rates-title" className="type-title">
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Tasas de conversión. Actualizar cotización"
          className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 py-1 text-left"
        >
          Tasas de conversión
          <Icon name="chevron-right" size="md" className="text-fg-soft" />
        </button>
      </h2>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-body font-medium text-fg">Dólar Blue / ARS</p>
          <span className="grid size-9 place-items-center rounded-pill bg-positive-bg text-positive">
            <Icon name="trend" size="sm" />
          </span>
        </div>

        {state.status === 'loading' ? (
          <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Cargando cotización">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : state.status === 'unavailable' ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-sunken p-4" role="status">
            <p className="text-body-sm text-fg-soft">
              La cotización no está disponible en este momento. El resto de la app sigue funcionando.
            </p>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <Icon name="refresh" size="sm" />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-sunken p-4">
                <dt className="type-eyebrow">Compra</dt>
                <dd className="type-number type-title mt-2 text-fg" data-testid="rate-buy">
                  {formatRate(state.rate.buy)}
                </dd>
              </div>
              <div className="rounded-2xl bg-sunken p-4">
                <dt className="type-eyebrow">Venta</dt>
                <dd className="type-number type-title mt-2 text-fg" data-testid="rate-sell">
                  {formatRate(state.rate.sell)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-fg-soft">
              {state.rate.updatedAt
                ? `Actualizado ${updatedFormatter.format(new Date(state.rate.updatedAt)).replace(',', '')} · `
                : ''}
              Fuente: {state.rate.source.name}
            </p>
          </>
        )}
      </Card>
    </section>
  )
}
