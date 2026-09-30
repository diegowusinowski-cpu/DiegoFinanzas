import { useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const

interface NumericKeypadProps {
  /** `0-9`, `,` o `backspace`. */
  onKey(key: string): void
}

/** Teclado numérico de calculadora financiera: teclas grandes, sin fondo. También responde al teclado físico. */
export function NumericKeypad({ onKey }: NumericKeypadProps) {
  const handler = useRef(onKey)
  useEffect(() => {
    handler.current = onKey
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (/^\d$/.test(event.key)) handler.current(event.key)
      else if (event.key === ',' || event.key === '.') handler.current(',')
      else if (event.key === 'Backspace') handler.current('backspace')
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const key =
    'interactive font-numeric mx-auto grid h-16 w-full max-w-24 place-items-center rounded-pill text-[2rem] text-fg select-none hover:bg-sunken active:bg-sunken-hover'

  return (
    <div role="group" aria-label="Teclado numérico" className="grid grid-cols-3 px-gutter">
      {ROWS.flat().map((digit) => (
        <button key={digit} type="button" className={key} onClick={() => onKey(digit)}>
          {digit}
        </button>
      ))}
      <button type="button" className={key} onClick={() => onKey(',')} aria-label="Coma decimal">
        ,
      </button>
      <button type="button" className={key} onClick={() => onKey('0')}>
        0
      </button>
      <button type="button" className={key} onClick={() => onKey('backspace')} aria-label="Borrar último dígito">
        <Icon name="arrow-left" size="lg" />
      </button>
    </div>
  )
}
