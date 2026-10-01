import { Skeleton } from './Card'
import { Icon } from './Icon'
import type { RateState } from '../hooks/useExchangeRate'
import { Button } from './Button'
import { SectionHeader } from './SectionHeader'

const rateFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const updatedFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const formatRate = (value: number) => rateFormatter.format(value).replace(/\u00a0/g, ' ')

export function RatesCard({ state, onRefresh }: { state: RateState; onRefresh(): void }) {
  return (
    <section aria-labelledby="rates-title" className="flex flex-col gap-block">
      <SectionHeader
        id="rates-title"
        title={
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Tasas de conversión. Actualizar cotización"
            className="interactive -ml-1 inline-flex items-center gap-1 rounded-control px-1 py-1 text-left"
          >
            Tasas de conversión
            <Icon name="chevron-right" size="sm" className="text-fg-soft" />
          </button>
        }
      />

      {state.status === 'loading' ? (
        <div className="flex items-center justify-between gap-4 py-row" aria-busy="true" aria-label="Cargando cotización">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
      ) : state.status === 'unavailable' ? (
        <div className="flex items-center justify-between gap-3 py-row" role="status">
          <p className="min-w-0 flex-1 text-body-sm text-fg-soft">
            La cotización no está disponible en este momento. El resto de la app sigue funcionando.
          </p>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <Icon name="refresh" size="sm" />
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="py-row">
          <div className="flex items-start justify-between gap-4">
            <p className="type-subheading min-w-0 pt-0.5 text-fg">Dólar Blue / ARS</p>
            <dl className="flex shrink-0 gap-5 text-right">
              <div className="flex flex-col-reverse gap-0.5">
                <dt className="text-caption text-fg-soft">Compra</dt>
                <dd className="type-number type-subheading text-fg" data-testid="rate-buy">
                  {formatRate(state.rate.buy)}
                </dd>
              </div>
              <div className="flex flex-col-reverse gap-0.5">
                <dt className="text-caption text-fg-soft">Venta</dt>
                <dd className="type-number type-subheading text-fg" data-testid="rate-sell">
                  {formatRate(state.rate.sell)}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-2 text-caption text-fg-soft" data-testid="rate-updated">
            {state.rate.updatedAt ? 'Actualizado' : 'Consultado'}{' '}
            {updatedFormatter.format(new Date(state.rate.updatedAt ?? state.rate.fetchedAt)).replace(',', '')} · Fuente:{' '}
            {state.rate.source.name}
          </p>
          {state.stale ? (
            <div className="mt-2 flex items-center justify-between gap-3" role="status">
              <p className="min-w-0 flex-1 text-caption text-warning">
                No pudimos actualizar. Mostramos la última cotización válida.
              </p>
              <Button variant="secondary" size="sm" onClick={onRefresh}>
                <Icon name="refresh" size="sm" />
                Reintentar
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
