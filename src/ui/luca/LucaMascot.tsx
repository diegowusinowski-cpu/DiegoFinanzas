import { cx } from '../cx'
import { LUCA_POSES, type LucaState } from './poses'
import { useReducedMotion } from './useReducedMotion'

export type LucaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
/** Alto en píxeles de cada tamaño predefinido. */
export const LUCA_SIZES: Record<LucaSize, number> = { xs: 32, sm: 40, md: 64, lg: 96, xl: 144 }

/**
 *  - `none`: quieta.
 *  - `enter`: aparece con un movimiento suave (una vez).
 *  - `idle`: entra y después se balancea apenas, 2 veces, y descansa.
 *  - `celebrate`: celebración breve (una vez).
 *  - `walk`: camina en el lugar; solo para esperas (se corta sola cuando termina la espera).
 */
export type LucaAnimation = 'none' | 'enter' | 'idle' | 'celebrate' | 'walk'

const ANIMATION_CLASS: Record<LucaAnimation, string> = {
  none: '',
  enter: 'animate-luca-enter',
  idle: 'animate-luca-settle',
  celebrate: 'animate-luca-celebrate',
  walk: 'animate-luca-walk',
}

export interface LucaMascotProps {
  /** Pose/expresión (por defecto, la normal). */
  state?: LucaState
  /** Tamaño predefinido o alto en píxeles. */
  size?: LucaSize | number
  /** Alineación dentro de su contenedor. */
  align?: 'start' | 'center' | 'end'
  animation?: LucaAnimation
  /** Retraso de la animación, en milisegundos. */
  delayMs?: number
  /**
   * Texto para lectores de pantalla. Sin él, Luca es decorativo (oculto para tecnologías de apoyo):
   * nada de la app depende de ella.
   */
  label?: string
  /** Fondo claro redondo, para usarla sobre superficies oscuras (p. ej. el encabezado verde). */
  chip?: boolean
  /** Carga inmediata (solo para lo que se ve apenas se abre la pantalla); el resto se carga cuando hace falta. */
  priority?: boolean
  /**
   * `auto` respeta `prefers-reduced-motion`; `reduced` fuerza la versión quieta (útil para pruebas o
   * ajustes futuros). Con `reduced` nunca se anima.
   */
  motion?: 'auto' | 'reduced'
  className?: string
}

const ALIGN = { start: 'mr-auto', center: 'mx-auto', end: 'ml-auto' } as const

/**
 * Luca, la mascota de DWF. Un único componente para todas sus apariciones: elegís el estado y el
 * tamaño; la imagen, la proporción, la animación y la accesibilidad se resuelven acá.
 */
export function LucaMascot({
  state = 'default',
  size = 'md',
  align,
  animation = 'enter',
  delayMs,
  label,
  chip = false,
  priority = false,
  motion = 'auto',
  className,
}: LucaMascotProps) {
  const prefersReduced = useReducedMotion()
  const reduced = motion === 'reduced' || prefersReduced
  const pose = LUCA_POSES[state]
  const height = typeof size === 'number' ? size : LUCA_SIZES[size]
  const animated = !reduced && animation !== 'none'
  const imageHeight = chip ? Math.round(height * 0.84) : height

  return (
    <span
      data-luca={state}
      data-motion={reduced ? 'reduced' : 'full'}
      data-animation={animated ? animation : 'none'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      style={{
        ...(chip ? { width: height, height } : {}),
        ...(animated && delayMs ? { animationDelay: `${delayMs}ms` } : {}),
      }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        chip && 'overflow-hidden rounded-pill bg-surface-elevated',
        align && ALIGN[align],
        animated && ANIMATION_CLASS[animation],
        className,
      )}
    >
      <img
        src={pose.src}
        alt=""
        width={pose.width}
        height={pose.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={{ height: imageHeight, width: 'auto', aspectRatio: `${pose.width} / ${pose.height}` }}
        className="block max-w-full object-contain select-none"
      />
    </span>
  )
}
