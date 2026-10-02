import { useSyncExternalStore } from 'react'

/** Evento no estándar de Chrome/Edge/Samsung Internet: permite mostrar el cuadro nativo de instalación. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'ios' | 'android' | 'other'

export interface InstallState {
  /** Ya está instalada y abierta como app (no hay nada que instalar). */
  standalone: boolean
  platform: InstallPlatform
  /** El navegador ofrece el cuadro de instalación nativo (Android/Chrome, escritorio). */
  nativePrompt: boolean
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
let snapshot: InstallState | null = null
const listeners = new Set<() => void>()

function emit() {
  snapshot = null
  for (const listener of listeners) listener()
}

export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  // iPadOS 13+ se presenta como Mac, pero con pantalla táctil.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  return 'other'
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const displayMode = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayMode
}

/**
 * Escucha el evento de instalación lo antes posible (se dispara apenas carga la página, antes de que
 * se dibuje el acceso). Se llama una vez desde `main.tsx`.
 */
export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

function read(): InstallState {
  snapshot ??= {
    standalone: installed || isStandalone(),
    platform: typeof navigator === 'undefined' ? 'other' : detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    nativePrompt: deferred !== null,
  }
  return snapshot
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, read, read)
}

/** Abre el cuadro nativo de instalación. Devuelve `false` si no está disponible. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  await event.prompt()
  const choice = await event.userChoice
  deferred = null
  emit()
  return choice.outcome === 'accepted'
}

/** Solo para pruebas. */
export function __resetInstallForTests(): void {
  deferred = null
  installed = false
  snapshot = null
  listeners.clear()
}
