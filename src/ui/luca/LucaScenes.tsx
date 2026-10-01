import { cx } from '../cx'
import { LucaMascot, type LucaSize } from './LucaMascot'
import type { LucaState } from './states'

/** Estado vacío con Luca: la pose arriba y el mismo texto de siempre debajo. */
export function LucaEmptyState({
  variant,
  title,
  children,
  size = 'lg',
}: {
  variant: LucaState
  title: string
  children?: string
  size?: LucaSize | number
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <LucaMascot variant={variant} size={size} animation="settle" />
      <p className="type-subheading text-fg">{title}</p>
      {children ? <p className="max-w-[18rem] text-body-sm text-fg-soft">{children}</p> : null}
    </div>
  )
}

/**
 * Espera con Luca caminando en el lugar. Reemplaza al loader genérico; el texto accesible avisa que
 * se está cargando y, con movimiento reducido, Luca queda quieta.
 */
export function LucaLoader({ label, className, size = 'lg' }: { label: string; className?: string; size?: LucaSize | number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cx('flex flex-col items-center gap-2', className)}>
      <LucaMascot variant="loading" size={size} />
      <p aria-hidden="true" className="text-body-sm text-fg-soft">
        {label}
      </p>
    </div>
  )
}
