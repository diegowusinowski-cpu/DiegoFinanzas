import { useMemo, useState } from 'react'
import { filterMovements, groupMovements, type MovementFilter, type Transaction } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { IconButton } from '../components/Button'
import { EmptyState, Skeleton } from '../components/Card'
import { Icon } from '../components/Icon'
import { FlowHeader } from '../flow/FlowFrame'
import { FILTER_LABEL, FilterSheet } from '../movements/FilterSheet'
import { MovementDetail } from '../movements/MovementDetail'
import { MovementRow } from '../movements/MovementRow'

/**
 * Movimientos: buscador, filtro Todos/Gastos/Ingresos y listado agrupado por
 * período. Usa los mismos movimientos persistidos que el resto de la app.
 */
export function MovementsScreen({ onBack }: { onBack(): void }) {
  const { status, history, categories, today } = useFinance()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MovementFilter>('ALL')
  const [filterOpen, setFilterOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = useMemo(
    () => groupMovements(filterMovements(history, { filter, query }, categories, today), today),
    [history, filter, query, categories, today],
  )
  const opened: Transaction | undefined = history.find((t) => t.id === openId)
  const filtering = filter !== 'ALL' || query.trim() !== ''

  return (
    <>
      <div className="animate-rise">
      <div className="sticky top-0 z-10 bg-canvas">
        <FlowHeader
          onBack={onBack}
          backLabel="Volver al inicio"
          title="Movimientos"
          heading
          trailing={
            <span className="relative">
              <IconButton
                variant="secondary"
                size="md"
                onClick={() => setFilterOpen(true)}
                aria-label={`Filtrar movimientos. Filtro actual: ${FILTER_LABEL[filter]}`}
                aria-haspopup="dialog"
              >
                <Icon name="filter" />
              </IconButton>
              {filter !== 'ALL' ? (
                <span
                  data-testid="filter-active"
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 size-2.5 rounded-pill bg-action ring-2 ring-canvas"
                />
              ) : null}
            </span>
          }
        />

        <div className="px-gutter pb-3">
          <label className="relative block">
            <span className="sr-only">Buscar movimientos</span>
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-soft"
            />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Buscar"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="interactive h-control-md w-full appearance-none rounded-pill border border-transparent bg-sunken pr-11 pl-11 text-body text-fg outline-none focus:border-fg focus:bg-surface [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <IconButton
                variant="tertiary"
                size="sm"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-fg-soft"
              >
                <Icon name="close" size="sm" />
              </IconButton>
            ) : null}
          </label>
        </div>
      </div>

      <div className="px-gutter pt-1">
        {status === 'loading' ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando movimientos">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState icon="list" title="Todavía no hay movimientos">
            Tus ingresos y gastos se van a listar acá, del más reciente al más antiguo.
          </EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState icon="search" title="Sin resultados">
            {filtering ? 'Probá con otra búsqueda o cambiá el filtro.' : ''}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6 pb-2">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="flex flex-col gap-1">
                <h2 className="type-eyebrow font-medium">{group.label}</h2>
                <ul>
                  {group.items.map((t) => (
                    <MovementRow
                      key={t.id}
                      transaction={t}
                      today={today}
                      onOpen={(tx) => setOpenId(tx.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Fuera del contenedor animado: sus capas fijas deben cubrir toda la pantalla. */}
      <FilterSheet
        open={filterOpen}
        value={filter}
        onSelect={(next) => {
          setFilter(next)
          setFilterOpen(false)
        }}
        onClose={() => setFilterOpen(false)}
      />
      {opened ? (
        <MovementDetail
          transaction={opened}
          category={categories.find((c) => c.id === opened.categoryId)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  )
}
