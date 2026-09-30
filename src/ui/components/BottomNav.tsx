import { cx } from '../cx'
import { Icon, type IconName } from './Icon'

export type Tab = 'home' | 'movements' | 'loans' | 'more'

interface BottomNavProps {
  active: Tab
  onSelect(tab: Tab): void
  onAdd(): void
}

const ITEMS: Array<{ tab: Tab; label: string; icon: IconName }> = [
  { tab: 'home', label: 'Inicio', icon: 'home' },
  { tab: 'movements', label: 'Movimientos', icon: 'list' },
  { tab: 'loans', label: 'Préstamos', icon: 'loan' },
  { tab: 'more', label: 'Más', icon: 'more' },
]

/**
 * Barra inferior integrada al fondo: vidrio cálido, ítems de 44 px, activo con
 * cápsula elevada y "+" como único elemento de acento. Un degradé al color del
 * fondo evita el corte brusco del contenido detrás.
 */
export function BottomNav({ active, onSelect, onAdd }: BottomNavProps) {
  const item = ({ tab, label, icon }: (typeof ITEMS)[number]) => {
    const isActive = active === tab
    return (
      <button
        key={tab}
        type="button"
        onClick={() => onSelect(tab)}
        aria-current={isActive ? 'page' : undefined}
        className={cx(
          'interactive flex min-h-nav-item flex-col items-center justify-center gap-0.5 rounded-pill px-0.5 text-[0.625rem] leading-none font-medium',
          isActive ? 'bg-surface-elevated text-fg shadow-card' : 'text-fg-soft hover:text-fg',
        )}
      >
        <Icon name={icon} />
        {label}
      </button>
    )
  }

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-canvas via-canvas/80 to-transparent"
      />
      <div className="relative px-4 pb-safe">
        <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1 rounded-pill border border-line bg-nav p-1 shadow-float backdrop-blur-xl">
          {item(ITEMS[0]!)}
          {item(ITEMS[1]!)}
          <button
            type="button"
            onClick={onAdd}
            aria-label="Registrar movimiento"
            className="interactive mx-1 grid size-control-md place-items-center rounded-pill bg-action text-on-action hover:bg-action-hover active:bg-action-pressed"
          >
            <Icon name="plus" size="lg" />
          </button>
          {item(ITEMS[2]!)}
          {item(ITEMS[3]!)}
        </div>
      </div>
    </nav>
  )
}
