import { cx } from '../cx'
import { LOGO_ASPECT, LOGO_PATH, LOGO_VIEWBOX } from './logoPaths'

export const LOGO_NAME = 'DiegoFinanzas'

const SIZES = {
  /** Encabezado del Home. */
  sm: 'h-logo-sm',
  /** Acceso y pantalla de carga. */
  lg: 'h-logo-lg',
} as const

interface LogoProps {
  size?: keyof typeof SIZES
  className?: string
}

/**
 * Logotipo DiegoFinanzas: DIEGO / FINANZAS apilado en display ultra condensado
 * (curvas SVG, no depende de fuentes). Toma el color del texto (`currentColor`).
 */
export function LogoDiegoFinanzas({ size = 'sm', className }: LogoProps) {
  return (
    <svg
      role="img"
      aria-label={LOGO_NAME}
      viewBox={LOGO_VIEWBOX}
      fill="currentColor"
      className={cx('block w-auto shrink-0', SIZES[size], className)}
      style={{ aspectRatio: LOGO_ASPECT }}
    >
      <path d={LOGO_PATH} />
    </svg>
  )
}
