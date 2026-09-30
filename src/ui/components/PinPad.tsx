import { useEffect, useRef } from 'react'
import { PIN_LENGTH } from '@/services/auth'
import { cx } from '../cx'
import { Icon } from './Icon'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

interface PinDotsProps {
  length: number
  shake?: boolean
  label: string
}

export function PinDots({ length, shake = false, label }: PinDotsProps) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${length} de ${PIN_LENGTH} dígitos`}
      className={cx('flex items-center justify-center gap-5', shake && 'animate-shake')}
    >
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <span
          key={i}
          className={cx(
            'size-4 rounded-full border-2 border-ink transition duration-150',
            i < length ? 'scale-110 bg-ink' : 'bg-transparent',
          )}
        />
      ))}
    </div>
  )
}

interface PinPadProps {
  onDigit(digit: string): void
  onBackspace(): void
  disabled?: boolean
}

/** Teclado numérico grande. También responde al teclado físico. */
export function PinPad({ onDigit, onBackspace, disabled = false }: PinPadProps) {
  const handlers = useRef({ onDigit, onBackspace })
  useEffect(() => {
    handlers.current = { onDigit, onBackspace }
  })

  useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (/^\d$/.test(event.key)) handlers.current.onDigit(event.key)
      else if (event.key === 'Backspace') handlers.current.onBackspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled])

  const keyClass =
    'grid aspect-[1.35] w-full place-items-center rounded-3xl bg-surface text-3xl font-semibold text-ink shadow-card transition duration-100 select-none hover:bg-sunken active:scale-95 active:bg-sunken disabled:opacity-40 disabled:active:scale-100'

  return (
    <div className="grid w-full grid-cols-3 gap-3" role="group" aria-label="Teclado numérico">
      {KEYS.map((digit) => (
        <button key={digit} type="button" className={keyClass} disabled={disabled} onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
      <span aria-hidden="true" />
      <button type="button" className={keyClass} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button
        type="button"
        className={cx(keyClass, 'bg-transparent shadow-none hover:bg-sunken')}
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Borrar último dígito"
      >
        <Icon name="backspace" size={28} />
      </button>
    </div>
  )
}
