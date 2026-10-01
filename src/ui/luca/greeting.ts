import { useEffect, useState } from 'react'

/** Cuánto dura el saludo de Luca al abrir el Inicio. */
export const LUCA_GREETING_MS = 1800

let greeted = false

/**
 * `true` durante los primeros instantes del primer Inicio de la sesión: Luca saluda una sola vez y
 * después queda en su estado normal (no vuelve a saludar cada vez que se cambia de pestaña).
 */
export function useLucaGreeting(): boolean {
  const [active, setActive] = useState(() => !greeted)

  useEffect(() => {
    if (!active) return
    greeted = true
    const timer = setTimeout(() => setActive(false), LUCA_GREETING_MS)
    return () => clearTimeout(timer)
  }, [active])

  return active
}

/** Para pruebas: vuelve a habilitar el saludo inicial. */
export function resetLucaGreeting(): void {
  greeted = false
}
