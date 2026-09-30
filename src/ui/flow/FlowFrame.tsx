import type { ReactNode } from 'react'
import { cx } from '../cx'
import { IconButton } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'

/** Pantalla completa del flujo (columna móvil centrada en pantallas anchas). */
export function FlowFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-backdrop">
      <div className={cx('relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-canvas', className)}>
        {children}
      </div>
    </div>
  )
}

interface FlowHeaderProps {
  onBack(): void
  backLabel: string
  backIcon?: IconName
  title?: string
  subtitle?: string
  trailing?: ReactNode
  /** El título es el encabezado principal de la pantalla (h1). */
  heading?: boolean
}

/** Barra superior: volver a la izquierda, contexto al centro, acción decorativa a la derecha. */
export function FlowHeader({ onBack, backLabel, backIcon = 'chevron-left', title, subtitle, trailing, heading = false }: FlowHeaderProps) {
  return (
    <header className="grid min-h-16 shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 px-gutter pt-safe pb-2">
      <IconButton variant="secondary" size="md" onClick={onBack} aria-label={backLabel}>
        <Icon name={backIcon} />
      </IconButton>
      <div className="min-w-0 text-center">
        {title ? (
          heading ? (
            <h1 className="type-subheading line-clamp-2 text-fg">{title}</h1>
          ) : (
            <p className="type-subheading line-clamp-2 text-fg">{title}</p>
          )
        ) : null}
        {subtitle ? <p className="truncate text-body-sm text-fg-soft">{subtitle}</p> : null}
      </div>
      <div className="grid size-control-md place-items-center">{trailing}</div>
    </header>
  )
}
