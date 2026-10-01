import { LUCA_POSES } from './poses'
import { LUCA_STATE_SPEC, type LucaState } from './states'

const requested = new Set<string>()

/**
 * Precarga (sin bloquear nada) las poses que Luca va a necesitar enseguida, para que el cambio de
 * gesto no espere a la red. Se hace cuando el navegador está libre y se omite con "ahorro de datos".
 */
export function preloadLuca(variants: readonly LucaState[]): void {
  if (typeof window === 'undefined') return
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return
  const sources = variants
    .map((variant) => LUCA_POSES[LUCA_STATE_SPEC[variant].pose].src)
    .filter((src) => !requested.has(src))
  if (sources.length === 0) return
  const run = () => {
    for (const src of sources) {
      if (requested.has(src)) continue
      requested.add(src)
      const image = new Image()
      image.decoding = 'async'
      image.src = src
    }
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}
