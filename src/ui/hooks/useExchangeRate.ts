import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExchangeRate } from '@/services/rates'
import { useServices } from '@/state/ServicesContext'

export type RateState =
  | { status: 'loading' }
  /** `stale`: no se pudo actualizar; se muestra la última cotización válida con su fecha. */
  | { status: 'ready'; rate: ExchangeRate; stale: boolean }
  | { status: 'unavailable' }

/** Mientras la app está abierta se vuelve a consultar con esta frecuencia (además de al abrirla). */
export const RATE_REFRESH_MS = 30 * 60_000

/**
 * Cotización del Dólar Blue (DolarHoy.com). Al abrir la app muestra al instante la última
 * cotización válida guardada y la actualiza; si la fuente falla conserva ese dato, nunca lo borra.
 */
export function useUsdBlueRate() {
  const { rates } = useServices()
  const [state, setState] = useState<RateState>(() => {
    const cached = rates.getCached?.() ?? null
    return cached ? { status: 'ready', rate: cached, stale: false } : { status: 'loading' }
  })
  const controller = useRef<AbortController | null>(null)
  const lastSuccess = useRef(0)

  const fetchRate = useCallback(() => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    rates.getUsdBlue(ctrl.signal).then(
      (rate) => {
        if (ctrl.signal.aborted) return
        lastSuccess.current = Date.now()
        setState({ status: 'ready', rate, stale: false })
      },
      () => {
        if (ctrl.signal.aborted) return
        // Conserva la última cotización válida (aunque sea vieja); solo hay "no disponible" si nunca hubo una.
        setState((prev) => (prev.status === 'ready' ? { ...prev, stale: true } : { status: 'unavailable' }))
      },
    )
  }, [rates])

  useEffect(() => {
    fetchRate()
    const timer = setInterval(fetchRate, RATE_REFRESH_MS)
    // Al volver a la app después de un rato, se actualiza sin esperar al próximo ciclo.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSuccess.current >= RATE_REFRESH_MS) fetchRate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      controller.current?.abort()
    }
  }, [fetchRate])

  /** Reintento manual: muestra "cargando" solo si todavía no hay ninguna cotización. */
  const refresh = useCallback(() => {
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    fetchRate()
  }, [fetchRate])

  return { state, refresh }
}
