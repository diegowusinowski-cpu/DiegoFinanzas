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
  const item = ({ tab, label, icon }: (typeof ITEMS)[number]) => (
    <button
      key={tab}
      type="button"
      onClick={() => onSelect(tab)}
      aria-current={active === tab ? 'page' : undefined}
      className={cx(
        'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-semibold transition',
        active === tab ? 'text-ink' : 'text-muted hover:text-ink-soft',
      )}
    >
      <Icon name={icon} size={22} strokeWidth={active === tab ? 2.2 : 1.8} />
      {label}
    </button>
  )

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-safe"
    >
      <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-1 rounded-[2rem] border border-line/70 bg-surface/90 px-3 py-2 shadow-float backdrop-blur-xl">
        {item(ITEMS[0]!)}
        {item(ITEMS[1]!)}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Registrar movimiento"
          className="mx-2 grid size-14 place-items-center rounded-full bg-ink text-white shadow-float transition active:scale-95"
        >
          <Icon name="plus" size={28} strokeWidth={2.4} />
        </button>
        {item(ITEMS[2]!)}
      </div>
    </nav>
  )
}
