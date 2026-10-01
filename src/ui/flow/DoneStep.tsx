import { useEffect, useRef } from 'react'
import type { CurrencyCode, TransactionType } from '@/domain'
import { LucaMascot, confirmedLuca } from '../luca'
import { AmountDisplay } from './AmountDisplay'

const COVER_MS = 650
const HOLD_MS = 1000

interface DoneStepProps {
  type: TransactionType
  text: string
  currency: CurrencyCode
  onFinished(): void
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Movimiento confirmado. Sube desde abajo cubriendo la pantalla (650 ms), el
 * check se dibuja y, tras ~1 s, el flujo vuelve al Home.
 */
export function DoneStep({ type, text, currency, onFinished }: DoneStepProps) {
  const finished = useRef(onFinished)
  useEffect(() => {
    finished.current = onFinished
  })

  useEffect(() => {
    const wait = prefersReducedMotion() ? HOLD_MS : COVER_MS + HOLD_MS
    const timer = setTimeout(() => finished.current(), wait)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="movement-done"
      className="absolute inset-0 z-10 flex animate-cover flex-col bg-canvas pt-safe pb-safe"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
        {/* Celebra un ingreso; en un gasto queda tranquila. Entra cuando la pantalla terminó de subir. */}
        <LucaMascot variant={confirmedLuca(type)} size="lg" delayMs={500} className="mb-1" />
        <h1 className="type-heading">Movimiento confirmado</h1>
        <div className="mt-4">
          <AmountDisplay text={text} currency={currency} />
        </div>
        <p className="text-body text-fg-muted">Hecho</p>
      </div>
      <div className="flex justify-center pb-10">
        <span
          data-testid="done-check"
          className="grid size-14 animate-pop place-items-center rounded-pill bg-action text-on-action"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} className="animate-draw" />
          </svg>
        </span>
      </div>
    </div>
  )
}
