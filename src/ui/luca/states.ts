import type { PoseId } from './poses'

/**
 * Sistema central de estados de Luca. Las pantallas piden un estado (`variant`) y todo lo demás
 * —qué pose, qué movimiento de entrada— se resuelve acá, para que el personaje se comporte igual en
 * toda la app y no haya lógica repetida en cada pantalla.
 */

export const LUCA_STATES = [
  'welcome', // sentada, saluda (entrada a la app)
  'idle', // normal, tranquila
  'happy', // contenta
  'celebrating', // celebra con confeti
  'thinking', // pensando
  'attentive', // atenta, con la campana
  'saving', // con la alcancía
  'lending', // con el comprobante
  'spending', // con la bolsa de compras
  'loading', // caminando mientras se espera
  'success', // confirmación, con el check
  'error', // preocupada pero tranquila
  'sleeping', // descansando (sin datos)
  'waving', // saluda guiñando un ojo
  'walking', // se desplaza unos pasos (transiciones)
  'excited', // contenta con saltitos
  'goal', // meta cumplida, con el trofeo
] as const

export type LucaState = (typeof LUCA_STATES)[number]

/**
 *  - `none`: quieta.
 *  - `enter`: aparece con un movimiento suave (una vez).
 *  - `greet`: aparece y se inclina apenas hacia el formulario (una vez).
 *  - `wave`: aparece y se balancea como saludando (una vez).
 *  - `settle`: aparece y se mece dos veces, y descansa.
 *  - `celebrate`: celebración breve (una vez).
 *  - `hop`: dos saltitos de alegría (una vez).
 *  - `nudge`: aparece y "avisa" con un pequeño sacudón (una vez).
 *  - `stroll`: da unos pasos de ida y vuelta (una vez).
 *  - `walk`: camina en el lugar; solo para esperas (se corta cuando termina la espera).
 */
export type LucaAnimation = 'none' | 'enter' | 'greet' | 'wave' | 'settle' | 'celebrate' | 'hop' | 'nudge' | 'stroll' | 'walk'

/** Gestos de la cara que se pueden pedir aparte del estado (cambian la pose y conservan el movimiento). */
export const LUCA_EXPRESSIONS = ['calm', 'happy', 'worried', 'wink', 'thinking', 'sleepy'] as const
export type LucaExpression = (typeof LUCA_EXPRESSIONS)[number]

export const EXPRESSION_POSE: Record<LucaExpression, PoseId> = {
  calm: 'idle',
  happy: 'happy',
  worried: 'error',
  wink: 'wink',
  thinking: 'thinking',
  sleepy: 'sleeping',
}

interface StateSpec {
  pose: PoseId
  /** Movimiento de entrada por defecto de este estado. */
  animation: LucaAnimation
}

export const LUCA_STATE_SPEC: Record<LucaState, StateSpec> = {
  welcome: { pose: 'welcome', animation: 'greet' },
  idle: { pose: 'idle', animation: 'enter' },
  happy: { pose: 'happy', animation: 'enter' },
  celebrating: { pose: 'celebrating', animation: 'celebrate' },
  thinking: { pose: 'thinking', animation: 'enter' },
  attentive: { pose: 'attentive', animation: 'nudge' },
  saving: { pose: 'saving', animation: 'enter' },
  lending: { pose: 'lending', animation: 'enter' },
  spending: { pose: 'spending', animation: 'enter' },
  loading: { pose: 'loading', animation: 'walk' },
  success: { pose: 'success', animation: 'enter' },
  error: { pose: 'error', animation: 'enter' },
  sleeping: { pose: 'sleeping', animation: 'enter' },
  waving: { pose: 'wink', animation: 'wave' },
  walking: { pose: 'loading', animation: 'stroll' },
  excited: { pose: 'happy', animation: 'hop' },
  goal: { pose: 'goal', animation: 'celebrate' },
}
