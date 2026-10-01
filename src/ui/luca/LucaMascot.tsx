import './luca.css'
import { cx } from '../cx'
import { LUCA_POSES, type LayerKey, type LucaPose, type PoseId } from './poses'
import {
  EXPRESSION_POSE,
  LUCA_STATE_SPEC,
  type LucaAnimation,
  type LucaExpression,
  type LucaState,
} from './states'
import { useBlink, useCrossfade, usePresence } from './useLucaLife'
import { useReducedMotion } from './useReducedMotion'

export type LucaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
/** Alto en píxeles de cada tamaño predefinido. */
export const LUCA_SIZES: Record<LucaSize, number> = { xs: 32, sm: 40, md: 64, lg: 96, xl: 144 }

export interface LucaMascotProps {
  /** Estado de Luca (por defecto, tranquila). Define la pose y el movimiento de entrada. */
  variant?: LucaState
  /** Gesto de la cara, aparte del estado: cambia la pose y conserva el movimiento del estado. */
  expression?: LucaExpression
  /** Tamaño predefinido o alto en píxeles. */
  size?: LucaSize | number
  /** Movimiento de entrada; sin indicarlo, el que corresponde al estado. */
  animation?: LucaAnimation
  /** Alineación dentro de su contenedor. */
  position?: 'start' | 'center' | 'end'
  /** Retraso de la animación, en milisegundos. */
  delayMs?: number
  /**
   * Texto para lectores de pantalla. Sin él, Luca es decorativa (oculta para tecnologías de apoyo):
   * nada de la app depende de ella.
   */
  label?: string
  /** Fondo claro redondo, para usarla sobre superficies oscuras (p. ej. el encabezado verde). */
  chip?: boolean
  /** Carga inmediata (solo para lo que se ve apenas se abre la pantalla); el resto se carga cuando hace falta. */
  priority?: boolean
  /** `false` la hace desaparecer con una salida suave (y vuelve a aparecer con `true`). */
  show?: boolean
  /** Con la pose grande de bienvenida: parpadea y mueve cola y orejas. Sin movimiento reducido. */
  alive?: boolean
  /**
   * `auto` respeta `prefers-reduced-motion`; `reduced` fuerza la versión quieta (útil para pruebas o
   * ajustes futuros). Con `reduced` nunca se anima.
   */
  motion?: 'auto' | 'reduced'
  className?: string
}

const POSITION = { start: 'mr-auto', center: 'mx-auto', end: 'ml-auto' } as const

/** Cada animación es una clase de `luca.css`; se listan completas para que no se pierdan al compilar. */
const ANIMATION_CLASS: Record<Exclude<LucaAnimation, 'none'>, string> = {
  enter: 'luca-anim-enter',
  greet: 'luca-anim-greet',
  wave: 'luca-anim-wave',
  settle: 'luca-anim-settle',
  celebrate: 'luca-anim-celebrate',
  hop: 'luca-anim-hop',
  nudge: 'luca-anim-nudge',
  stroll: 'luca-anim-stroll',
  walk: 'luca-anim-walk',
}

const LAYER_ORDER: readonly LayerKey[] = ['tail', 'earL', 'earR', 'marks', 'lids']

function PoseImage({ pose, height, eager, className }: { pose: LucaPose; height: number; eager: boolean; className?: string | undefined }) {
  return (
    <img
      src={pose.src}
      alt=""
      width={pose.width}
      height={pose.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      style={{ height, width: 'auto', aspectRatio: `${pose.width} / ${pose.height}` }}
      className={cx('block max-w-full object-contain select-none', className)}
    />
  )
}

/** La pose grande "viva": el cuerpo y, encima, cola, orejas, rayitas y párpados que se mueven aparte. */
function LayeredPose({ pose, height, eager }: { pose: LucaPose; height: number; eager: boolean }) {
  const layers = pose.layers
  const blinking = useBlink(true)
  if (!layers) return null
  const loading = eager ? 'eager' : 'lazy'
  return (
    <span
      data-luca-layers="true"
      className="luca-layers"
      style={{ height, width: (height * pose.width) / pose.height, aspectRatio: `${pose.width} / ${pose.height}` }}
    >
      <img src={layers.base} alt="" width={pose.width} height={pose.height} loading={loading} decoding="async" draggable={false} className="block select-none" />
      {LAYER_ORDER.map((key) => {
        const part = layers.parts[key]
        const origin = part.pivot ? `${(part.pivot[0] / pose.width) * 100}% ${(part.pivot[1] / pose.height) * 100}%` : undefined
        return (
          <img
            key={key}
            src={part.src}
            alt=""
            loading={loading}
            decoding="async"
            draggable={false}
            data-luca-part={key}
            data-closed={key === 'lids' ? blinking : undefined}
            style={{ ...(origin ? { transformOrigin: origin } : {}), ...(key === 'lids' ? { opacity: blinking ? 1 : 0 } : {}) }}
            className="pointer-events-none select-none"
          />
        )
      })}
    </span>
  )
}

/**
 * Luca, la mascota de DWF. Un único componente para todas sus apariciones: elegís el estado y el
 * tamaño; la imagen, la proporción, el movimiento, las transiciones y la accesibilidad se resuelven acá.
 */
export function LucaMascot({
  variant = 'idle',
  expression,
  size = 'md',
  animation,
  position,
  delayMs,
  label,
  chip = false,
  priority = false,
  show = true,
  alive = true,
  motion = 'auto',
  className,
}: LucaMascotProps) {
  const prefersReduced = useReducedMotion()
  const reduced = motion === 'reduced' || prefersReduced
  const spec = LUCA_STATE_SPEC[variant]
  const poseId: PoseId = expression ? EXPRESSION_POSE[expression] : spec.pose
  const pose = LUCA_POSES[poseId]
  const requested = animation ?? spec.animation
  const animated = !reduced && requested !== 'none'

  const { mounted, leaving } = usePresence(show, !reduced)
  const previousId = useCrossfade(poseId, !reduced)

  if (!mounted) return null

  const height = typeof size === 'number' ? size : LUCA_SIZES[size]
  const imageHeight = chip ? Math.round(height * 0.84) : height
  const layered = alive && !reduced && !chip && pose.layers !== undefined
  const animationName = leaving ? 'exit' : animated ? requested : 'none'
  const animationClass = leaving ? 'luca-anim-exit' : animated ? ANIMATION_CLASS[requested as Exclude<LucaAnimation, 'none'>] : ''

  return (
    <span
      data-luca={variant}
      data-pose={poseId}
      data-motion={reduced ? 'reduced' : 'full'}
      data-animation={animationName}
      data-presence={leaving ? 'leaving' : 'present'}
      {...(label && !leaving ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      style={{
        ...(chip ? { width: height, height } : {}),
        ...(animated && delayMs ? { animationDelay: `${delayMs}ms` } : {}),
      }}
      className={cx(
        'pointer-events-none inline-flex shrink-0 items-center justify-center',
        chip && 'overflow-hidden rounded-pill bg-surface-elevated',
        position && POSITION[position],
        animationClass,
        className,
      )}
    >
      <span className="luca-stack">
        {previousId ? <PoseImage pose={LUCA_POSES[previousId]} height={imageHeight} eager className="luca-fade-out" /> : null}
        {layered ? (
          <LayeredPose pose={pose} height={imageHeight} eager={priority} />
        ) : (
          <PoseImage pose={pose} height={imageHeight} eager={priority} className={previousId ? 'luca-fade-in' : undefined} />
        )}
      </span>
    </span>
  )
}
