import type { MovementFilter } from '@/domain'
import { cx } from '../cx'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'

export const FILTER_LABEL: Record<MovementFilter, string> = {
  ALL: 'Todos',
  EXPENSE: 'Gastos',
  INCOME: 'Ingresos',
}

const OPTIONS: MovementFilter[] = ['ALL', 'EXPENSE', 'INCOME']

interface FilterSheetProps {
  open: boolean
  value: MovementFilter
  onSelect(filter: MovementFilter): void
  onClose(): void
}

/** Panel de filtro por tipo. Tocar una opción la aplica y cierra el panel; la X o Esc cierran sin cambios. */
export function FilterSheet({ open, value, onSelect, onClose }: FilterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Filtrar">
      <div role="radiogroup" aria-label="Tipo de movimiento" className="pb-2">
        {OPTIONS.map((option) => {
          const selected = option === value
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              data-autofocus={selected ? '' : undefined}
              onClick={() => onSelect(option)}
              className="interactive -mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center justify-between rounded-card px-2 text-left hover:bg-glass active:bg-glass-strong"
            >
              <span className={cx('text-body', selected ? 'font-medium text-fg' : 'text-fg-heading')}>
                {FILTER_LABEL[option]}
              </span>
              <span
                className={cx(
                  'grid size-6 place-items-center rounded-pill',
                  selected ? 'bg-action text-on-action' : 'border border-line text-transparent',
                )}
              >
                <Icon name="check" size="sm" />
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
