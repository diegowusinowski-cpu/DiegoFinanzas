import { cx } from '../cx'
import { Icon, type IconName } from './Icon'

export type Tab = 'home' | 'movements' | 'more'

interface BottomNavProps {
  active: Tab
  onSelect(tab: Tab): void
  onAdd(): void
}

const ITEMS: Array<{ tab: Tab; label: string; icon: IconName }> = [
  { tab: 'home', label: 'Inicio', icon: 'home' },
  { tab: 'movements', label: 'Movimientos', icon: 'list' },
  { tab: 'more', label: 'Más', icon: 'more' },
]

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
          'flex min-h-14 flex-col items-center justify-center gap-1 rounded-pill px-1 font-mono text-[0.625rem] leading-none tracking-[0.08em] uppercase transition-colors duration-200',
          isActive ? 'bg-glass-strong text-fg' : 'text-fg-soft hover:text-fg',
        )}
      >
        <Icon name={icon} size={21} strokeWidth={isActive ? 1.9 : 1.5} />
        {label}
      </button>
    )
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-safe"
    >
      <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-1 rounded-pill border border-line bg-surface/80 p-1.5 shadow-float backdrop-blur-2xl">
        {item(ITEMS[0]!)}
        {item(ITEMS[1]!)}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Registrar movimiento"
          className="mx-1.5 grid size-14 place-items-center rounded-pill bg-action text-fg-on-action transition-colors duration-200 hover:bg-cloud active:bg-silver"
        >
          <Icon name="plus" size={26} strokeWidth={1.75} />
        </button>
        {item(ITEMS[2]!)}
      </div>
    </nav>
  )
}
