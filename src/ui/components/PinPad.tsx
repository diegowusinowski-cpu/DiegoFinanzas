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
            'size-3.5 rounded-pill border border-pure transition duration-200 ease-out',
            i < length ? 'scale-110 bg-pure' : 'bg-transparent',
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
    'grid h-[4.25rem] w-full place-items-center rounded-card bg-surface text-[2rem] font-light text-fg transition-colors duration-200 select-none hover:bg-surface-hover active:bg-surface-hover disabled:opacity-40'

  return (
    <div className="grid w-full grid-cols-3 gap-2.5" role="group" aria-label="Teclado numérico">
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
        className={cx(keyClass, 'bg-transparent text-fg-soft hover:bg-glass')}
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Borrar último dígito"
      >
        <Icon name="backspace" size={26} />
      </button>
    </div>
  )
}
