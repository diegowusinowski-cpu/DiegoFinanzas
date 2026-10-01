import { useId } from 'react'
import { cx } from '../cx'

interface JarIllustrationProps {
  /** 0..1: cuánto del frasco está lleno (nunca se dibuja por encima del tope). */
  ratio: number
  /** Texto accesible (“Frasco al 20 %”). */
  label: string
  className?: string
}

// Geometría del frasco (viewBox 0 0 120 150).
const BODY =
  'M30 24H90Q94 24 94 28V36Q94 42 102 50Q106 54 106 60V126Q106 142 90 142H30Q14 142 14 126V60Q14 54 18 50Q26 42 26 36V28Q26 24 30 24Z'
const BOTTOM = 142
const FULL_TOP = 46

/**
 * Frasco ilustrado: vidrio, tapa y líquido que sube con el progreso. Es un componente aislado: si se
 * reemplaza por otra ilustración solo cambia este archivo.
 */
export function JarIllustration({ ratio, label, className }: JarIllustrationProps) {
  const clipId = useId()
  const clamped = Math.min(1, Math.max(0, ratio))
  const travel = (BOTTOM - FULL_TOP) * (1 - clamped)
  return (
    <svg viewBox="0 0 120 150" role="img" aria-label={label} className={cx('block', className)}>
      <defs>
        <clipPath id={clipId}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d={BODY} className="fill-surface" />
      <g clipPath={`url(#${clipId})`}>
        <g
          style={{ transform: `translateY(${travel}px)` }}
          className="transition-transform duration-700 ease-out motion-reduce:transition-none"
        >
          {/* Líquido: el borde superior ondulado queda siempre dentro del frasco. */}
          <path
            d={`M0 ${FULL_TOP + 3}Q15 ${FULL_TOP - 3} 30 ${FULL_TOP + 3}T60 ${FULL_TOP + 3}T90 ${FULL_TOP + 3}T120 ${FULL_TOP + 3}V160H0Z`}
            className="fill-positive-vivid"
          />
        </g>
      </g>
      <path d={BODY} fill="none" strokeWidth="3" className="stroke-fg-muted" strokeLinejoin="round" />
      <path d="M26 70V120" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-white/60" />
      <rect x="28" y="6" width="64" height="16" rx="5" className="fill-sand-400 stroke-fg-muted" strokeWidth="2" />
      <path d="M36 12H84" strokeWidth="2" strokeLinecap="round" className="stroke-white/70" />
    </svg>
  )
}
