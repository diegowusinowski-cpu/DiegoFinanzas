import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from './Icon'

/**
 * Superficies del sistema:
 *  - surface: card elevada sobre el fondo cálido
 *  - sunken:  superficie hundida (arena), para agrupar sin elevar
 *  - panel:   superficie financiera oscura (verde bosque)
 */
export type CardVariant = 'surface' | 'sunken' | 'panel'

const VARIANTS: Record<CardVariant, string> = {
  surface: 'rounded-card bg-surface text-fg shadow-card',
  sunken: 'rounded-card bg-sunken text-fg',
  panel: 'rounded-panel bg-panel text-on-panel',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

export function Card({ variant = 'surface', className, ...rest }: CardProps) {
  return <div className={cx(VARIANTS[variant], className)} {...rest} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-2xl bg-glass', className)} />
}

/** Estado vacío compacto: ícono a la izquierda y texto, sin caja propia. */
export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="grid size-avatar shrink-0 place-items-center rounded-pill bg-sunken text-fg-soft">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="type-subheading text-fg">{title}</p>
        {children ? <p className="text-body-sm text-fg-soft">{children}</p> : null}
      </div>
    </div>
  )
}
