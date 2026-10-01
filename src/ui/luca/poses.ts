import attentive from './assets/attentive.webp'
import celebrating from './assets/celebrating.webp'
import error from './assets/error.webp'
import goal from './assets/goal.webp'
import happy from './assets/happy.webp'
import idle from './assets/idle.webp'
import lending from './assets/lending.webp'
import loading from './assets/loading.webp'
import saving from './assets/saving.webp'
import sleeping from './assets/sleeping.webp'
import spending from './assets/spending.webp'
import success from './assets/success.webp'
import thinking from './assets/thinking.webp'
import welcome from './assets/welcome.webp'
import welcomeBase from './assets/welcome-base.webp'
import welcomeEarL from './assets/welcome-earL.webp'
import welcomeEarR from './assets/welcome-earR.webp'
import welcomeLids from './assets/welcome-lids.webp'
import welcomeMarks from './assets/welcome-marks.webp'
import welcomeTail from './assets/welcome-tail.webp'
import wink from './assets/wink.webp'

/**
 * Las imágenes de Luca. Cada pose es un recorte de la hoja oficial del personaje (mismo gato, mismo
 * collar y medalla, mismo estilo). Los estados de `states.ts` eligen una pose; varios estados pueden
 * compartir la misma imagen y diferenciarse por su animación, así que no se duplican assets.
 */
export const POSE_IDS = [
  'welcome',
  'idle',
  'happy',
  'celebrating',
  'thinking',
  'attentive',
  'saving',
  'lending',
  'spending',
  'loading',
  'success',
  'error',
  'sleeping',
  'wink',
  'goal',
] as const

export type PoseId = (typeof POSE_IDS)[number]

/** Partes sueltas de una pose "viva": cada una es un lienzo completo con solo esa parte. */
export type LayerKey = 'tail' | 'earL' | 'earR' | 'marks' | 'lids'

export interface PoseLayer {
  src: string
  /** Punto (en píxeles de la pose) alrededor del cual gira la parte. */
  pivot?: readonly [number, number]
}

export interface LucaPose {
  src: string
  /** Proporción real de la imagen (ancho / alto): evita saltos de diseño al cargar. */
  width: number
  height: number
  /** Descripción cuando Luca se anuncia a lectores de pantalla. */
  description: string
  /**
   * Solo la pose grande de bienvenida: el cuerpo y las partes que se mueven por separado (cola, orejas,
   * rayitas y párpados). Con movimiento reducido se usa la imagen entera, sin partes.
   */
  layers?: { base: string; parts: Readonly<Record<LayerKey, PoseLayer>> }
}

export const LUCA_POSES: Record<PoseId, LucaPose> = {
  welcome: {
    src: welcome,
    width: 305,
    height: 440,
    description: 'Luca te da la bienvenida',
    layers: {
      base: welcomeBase,
      parts: {
        tail: { src: welcomeTail, pivot: [247, 362] },
        earL: { src: welcomeEarL, pivot: [100, 78] },
        earR: { src: welcomeEarR, pivot: [228, 118] },
        marks: { src: welcomeMarks, pivot: [262, 150] },
        lids: { src: welcomeLids },
      },
    },
  },
  idle: { src: idle, width: 103, height: 122, description: 'Luca, la mascota de DWF' },
  happy: { src: happy, width: 111, height: 114, description: 'Luca, contenta' },
  celebrating: { src: celebrating, width: 148, height: 136, description: 'Luca celebra' },
  thinking: { src: thinking, width: 94, height: 126, description: 'Luca, pensando' },
  attentive: { src: attentive, width: 151, height: 120, description: 'Luca, atenta con una campana' },
  saving: { src: saving, width: 108, height: 106, description: 'Luca con una alcancía' },
  lending: { src: lending, width: 101, height: 110, description: 'Luca con un comprobante' },
  spending: { src: spending, width: 103, height: 82, description: 'Luca con una bolsa de compras' },
  loading: { src: loading, width: 89, height: 90, description: 'Luca camina mientras cargamos' },
  success: { src: success, width: 124, height: 85, description: 'Luca con un check de confirmación' },
  error: { src: error, width: 105, height: 117, description: 'Luca, preocupada pero tranquila' },
  sleeping: { src: sleeping, width: 133, height: 96, description: 'Luca durmiendo' },
  wink: { src: wink, width: 107, height: 118, description: 'Luca te guiña un ojo' },
  goal: { src: goal, width: 122, height: 110, description: 'Luca con un trofeo' },
}
