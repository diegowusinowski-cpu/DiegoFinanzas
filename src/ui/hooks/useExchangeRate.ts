import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExchangeRate } from '@/services/rates'
import { useServices } from '@/state/ServicesContext'

export type RateState =
  | { status: 'loading' }
  | { status: 'ready'; rate: ExchangeRate }
  | { status: 'unavailable' }

const REFRESH_MS = 5 * 60_000

/** Cotización del Dólar Blue: carga, reintento manual y refresco periódico. */
export function useUsdBlueRate() {
  const { rates } = useServices()
  const [state, setState] = useState<RateState>({ status: 'loading' })
  const controller = useRef<AbortController | null>(null)

  const fetchRate = useCallback(() => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    rates.getUsdBlue(ctrl.signal).then(
      (rate) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', rate })
      },
      () => {
        if (!ctrl.signal.aborted) setState({ status: 'unavailable' })
      },
    )
  }, [rates])

  useEffect(() => {
    fetchRate()
    const timer = setInterval(fetchRate, REFRESH_MS)
    return () => {
      clearInterval(timer)
      controller.current?.abort()
    }
  }, [fetchRate])

  /** Reintento manual: muestra "cargando" salvo que ya haya un valor vigente. */
  const refresh = useCallback(() => {
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    fetchRate()
  }, [fetchRate])

  return { state, refresh }
}
