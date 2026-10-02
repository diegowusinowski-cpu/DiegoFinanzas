import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallApp } from '@/ui/components/InstallApp'
import { __resetInstallForTests, detectPlatform, initInstallPrompt, isStandalone } from './install'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function setEnvironment({ userAgent, standalone = false, touch = 5 }: { userAgent: string; standalone?: boolean; touch?: number }) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: standalone && query.includes('display-mode: standalone'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  __resetInstallForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('detección de plataforma', () => {
  it('reconoce iPhone, iPad (que se presenta como Mac), Android y escritorio', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0)).toBe('other')
    expect(detectPlatform(SAMSUNG, 5)).toBe('android')
    expect(detectPlatform(DESKTOP, 0)).toBe('other')
  })

  it('detecta cuándo ya está abierta como app instalada', () => {
    setEnvironment({ userAgent: SAMSUNG, standalone: true })
    expect(isStandalone()).toBe(true)
    vi.unstubAllGlobals()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    expect(isStandalone()).toBe(true)
    Reflect.deleteProperty(navigator, 'standalone')
    expect(isStandalone()).toBe(false)
  })
})

describe('Instalar DWF', () => {
  it('iPhone/Safari: ofrece instrucciones con Compartir → Agregar a inicio', async () => {
    setEnvironment({ userAgent: IPHONE })
    render(<InstallApp />)
    await userEvent.click(screen.getByRole('button', { name: /Instalar DWF en tu celular/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Instalar DWF' }))
    expect(dialog.getByText('Safari', { selector: 'strong' })).toBeInTheDocument()
    expect(dialog.getByText('Compartir', { selector: 'strong' })).toBeInTheDocument()
    expect(dialog.getByText('Agregar a inicio')).toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: /Instalar ahora/ })).not.toBeInTheDocument()
  })

  it('Android sin cuadro nativo: instrucciones del menú del navegador', async () => {
    setEnvironment({ userAgent: SAMSUNG })
    render(<InstallApp />)
    await userEvent.click(screen.getByRole('button', { name: /Instalar DWF en tu celular/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Instalar DWF' }))
    expect(dialog.getByText('Instalar app')).toBeInTheDocument()
    expect(dialog.getByText('Agregar a pantalla de inicio')).toBeInTheDocument()
  })

  it('Android/Chrome con beforeinstallprompt: instala con el cuadro nativo', async () => {
    setEnvironment({ userAgent: SAMSUNG })
    initInstallPrompt()
    render(<InstallApp />)
    const event = fireInstallPrompt('accepted')
    expect(event.defaultPrevented).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: /Instalar DWF en tu celular/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Instalar DWF' }))
    await userEvent.click(dialog.getByRole('button', { name: /Instalar ahora/ }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Instalar DWF' })).not.toBeInTheDocument())
  })

  it('si ya está instalada (standalone) no muestra nada', () => {
    setEnvironment({ userAgent: IPHONE, standalone: true })
    const { container } = render(<InstallApp />)
    expect(container).toBeEmptyDOMElement()
  })

  it('en escritorio sin instalación posible no muestra nada; con el cuadro nativo sí', () => {
    setEnvironment({ userAgent: DESKTOP, touch: 0 })
    initInstallPrompt()
    const { container } = render(<InstallApp />)
    expect(container).toBeEmptyDOMElement()
    fireInstallPrompt()
    expect(screen.getByRole('button', { name: /Instalar DWF en tu celular/ })).toBeInTheDocument()
  })

  it('al instalarse (appinstalled) desaparece', () => {
    setEnvironment({ userAgent: SAMSUNG })
    initInstallPrompt()
    render(<InstallApp />)
    expect(screen.getByRole('button', { name: /Instalar DWF en tu celular/ })).toBeInTheDocument()
    setEnvironment({ userAgent: SAMSUNG, standalone: true })
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: /Instalar DWF/ })).not.toBeInTheDocument()
  })
})
