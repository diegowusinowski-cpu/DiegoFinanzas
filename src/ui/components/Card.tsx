import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from './Icon'

/**
 * Superficies del sistema. `surface` es la tarjeta base; el resto son paneles
 * de color pleno (texto oscuro) reservados para módulos.
 */
export type CardVariant = 'surface' | 'inverse' | 'iris' | 'orchid' | 'pale' | 'periwinkle'

const VARIANTS: Record<CardVariant, string> = {
  surface: 'rounded-card bg-surface text-fg',
  inverse: 'rounded-tile bg-surface-inverse text-void',
  iris: 'rounded-tile bg-iris-gleam text-void',
  orchid: 'rounded-tile bg-orchid-bloom text-void',
  pale: 'rounded-tile bg-pale-iris text-void',
  periwinkle: 'rounded-tile bg-periwinkle text-void',
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

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-9 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-pill border border-line bg-glass text-fg-soft">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-body font-medium text-fg">{title}</p>
      {children ? <p className="max-w-64 text-body-sm text-fg-soft">{children}</p> : null}
    </div>
  )
}
