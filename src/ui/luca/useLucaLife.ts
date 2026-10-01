import { useEffect, useState } from 'react'
import type { PoseId } from './poses'

/** Duración de las transiciones de Luca (aparecer, desaparecer, cambiar de pose), en milisegundos. */
export const LUCA_EXIT_MS = 280
export const LUCA_FADE_MS = 280

/**
 * Aparecer/desaparecer con suavidad: al pasar `show` a `false`, Luca sigue montada lo que dura la
 * animación de salida y recién ahí se retira. Sin animaciones, se retira al instante.
 */
export function usePresence(show: boolean, animated: boolean): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show)
  if (show && !mounted) setMounted(true)

  useEffect(() => {
    if (show || !mounted) return
    const timer = setTimeout(() => setMounted(false), animated ? LUCA_EXIT_MS : 0)
    return () => clearTimeout(timer)
  }, [show, mounted, animated])

  return { mounted: show || mounted, leaving: !show && mounted }
}

/**
 * Cambio de pose con fundido: devuelve la pose anterior mientras se desvanece (o `null` si no hay
 * transición en curso), para que Luca "cambie de gesto" sin saltos.
 */
export function useCrossfade(pose: PoseId, animated: boolean): PoseId | null {
  const [last, setLast] = useState(pose)
  const [previous, setPrevious] = useState<PoseId | null>(null)
  if (pose !== last) {
    setLast(pose)
    setPrevious(animated ? last : null)
  }

  useEffect(() => {
    if (previous === null) return
    const timer = setTimeout(() => setPrevious(null), LUCA_FADE_MS)
    return () => clearTimeout(timer)
  }, [previous])

  return previous
}

const MAX_BLINKS = 8

/**
 * Parpadeo ocasional (cada 3–6 s, 140 ms) para la Luca grande. Se detiene con la pestaña oculta y
 * después de unos cuantos parpadeos: es un detalle de vida, no una animación permanente.
 */
export function useBlink(active: boolean): boolean {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout>
    let blinks = 0
    const schedule = () => {
      if (blinks >= MAX_BLINKS) return
      timer = setTimeout(
        () => {
          if (document.hidden) return schedule()
          blinks += 1
          setClosed(true)
          timer = setTimeout(() => {
            setClosed(false)
            schedule()
          }, 140)
        },
        2800 + Math.random() * 3200,
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [active])

  return active && closed
}
