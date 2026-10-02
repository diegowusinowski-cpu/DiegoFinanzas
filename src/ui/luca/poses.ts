import celebrating from './assets/celebrating.webp'
import attentive from './assets/attentive.webp'
import defaultPose from './assets/default.webp'
import error from './assets/error.webp'
import goal from './assets/goal.webp'
import happy from './assets/happy.webp'
import lending from './assets/lending.webp'
import loading from './assets/loading.webp'
import saving from './assets/saving.webp'
import sleeping from './assets/sleeping.webp'
import spending from './assets/spending.webp'
import success from './assets/success.webp'
import thinking from './assets/thinking.webp'
import welcome from './assets/welcome.webp'

/**
 * Estados de Luca. Cada uno es una pose recortada de la hoja oficial del personaje (mismo gato, mismo
 * collar y medalla, mismo estilo), así que todas las apariciones son consistentes.
 */
export const LUCA_STATES = [
  'default', // normal, tranquila
  'welcome', // sentada, saluda (entrada)
  'happy', // feliz
  'celebrating', // celebrando con confeti
  'thinking', // pensando
  'attentive', // atenta, con una campana
  'saving', // con la alcancía
  'lending', // con un comprobante
  'loading', // caminando (cargando)
  'success', // confirmación, con el check
  'error', // preocupada pero tranquila
  'sleeping', // durmiendo (espera, sin datos)
  'goal', // meta cumplida, con el trofeo
  'spending', // con la bolsa de compras
] as const

export type LucaState = (typeof LUCA_STATES)[number]

export interface LucaPose {
  src: string
  /** Proporción real de la imagen (ancho / alto): evita saltos de diseño al cargar. */
  width: number
  height: number
  /** Descripción cuando Luca se anuncia a lectores de pantalla. */
  description: string
}

export const LUCA_POSES: Record<LucaState, LucaPose> = {
  default: { src: defaultPose, width: 103, height: 122, description: 'Luca, la mascota de DWF' },
  welcome: { src: welcome, width: 305, height: 440, description: 'Luca te da la bienvenida' },
  happy: { src: happy, width: 111, height: 114, description: 'Luca, contenta' },
  celebrating: { src: celebrating, width: 148, height: 136, description: 'Luca celebra' },
  thinking: { src: thinking, width: 94, height: 126, description: 'Luca, pensando' },
  attentive: { src: attentive, width: 151, height: 120, description: 'Luca, atenta con una campana' },
  saving: { src: saving, width: 108, height: 106, description: 'Luca con una alcancía' },
  lending: { src: lending, width: 101, height: 110, description: 'Luca con un comprobante' },
  loading: { src: loading, width: 89, height: 90, description: 'Luca camina mientras cargamos' },
  success: { src: success, width: 124, height: 85, description: 'Luca con un check de confirmación' },
  error: { src: error, width: 105, height: 117, description: 'Luca, preocupada pero tranquila' },
  sleeping: { src: sleeping, width: 133, height: 96, description: 'Luca durmiendo' },
  goal: { src: goal, width: 122, height: 110, description: 'Luca con un trofeo' },
  spending: { src: spending, width: 103, height: 82, description: 'Luca con una bolsa de compras' },
}
