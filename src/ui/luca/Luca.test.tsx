import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LucaEmptyState, LucaLoader } from './LucaScenes'
import { LUCA_SIZES, LucaMascot } from './LucaMascot'
import { LUCA_POSES, LUCA_STATES } from './poses'
import { confirmedLuca, flowLuca, homeLuca, jarLuca, loanLuca, remindersLuca } from './moods'

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LucaMascot', () => {
  it('tiene los 12 estados pedidos, cada uno con su imagen', () => {
    for (const state of ['default', 'welcome', 'happy', 'celebrating', 'thinking', 'attentive', 'saving', 'lending', 'loading', 'success', 'error', 'sleeping']) {
      expect(LUCA_STATES).toContain(state)
    }
    for (const state of LUCA_STATES) {
      expect(LUCA_POSES[state].src).toBeTruthy()
      expect(LUCA_POSES[state].src).toMatch(/\.webp$/)
    }
  })

  it('cada estado se renderiza como el mismo personaje con su pose', () => {
    for (const state of LUCA_STATES) {
      const { container, unmount } = render(<LucaMascot state={state} />)
      const root = container.querySelector('[data-luca]')
      expect(root).toHaveAttribute('data-luca', state)
      expect(root?.querySelector('img')).toHaveAttribute('src', LUCA_POSES[state].src)
      unmount()
    }
  })

  it('es decorativa por defecto: oculta para lectores de pantalla y sin texto alternativo', () => {
    const { container } = render(<LucaMascot state="happy" />)
    const root = container.querySelector('[data-luca]')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root?.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('con label se expone como imagen con ese nombre', () => {
    render(<LucaMascot state="welcome" label="Luca te saluda" />)
    expect(screen.getByRole('img', { name: 'Luca te saluda' })).toBeInTheDocument()
  })

  it('tamaños predefinidos y alto libre; la proporción de la pose no se deforma', () => {
    const { container, rerender } = render(<LucaMascot state="default" size="lg" />)
    const img = () => container.querySelector('img') as HTMLImageElement
    expect(img().style.height).toBe(`${LUCA_SIZES.lg}px`)
    expect(img().style.aspectRatio.replace(/\s/g, '')).toBe(`${LUCA_POSES.default.width}/${LUCA_POSES.default.height}`)
    rerender(<LucaMascot state="default" size={104} />)
    expect(img().style.height).toBe('104px')
  })

  it('la imagen inicial (priority) carga ya; las demás poses se cargan de forma diferida', () => {
    const { container, rerender } = render(<LucaMascot state="welcome" priority />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
    rerender(<LucaMascot state="sleeping" />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })

  it('anima según lo pedido y puede quedar quieta', () => {
    mockReducedMotion(false)
    const { container, rerender } = render(<LucaMascot state="celebrating" animation="celebrate" delayMs={500} />)
    const root = () => container.querySelector('[data-luca]') as HTMLElement
    expect(root()).toHaveAttribute('data-animation', 'celebrate')
    expect(root().className).toContain('animate-luca-celebrate')
    expect(root().style.animationDelay).toBe('500ms')
    rerender(<LucaMascot state="celebrating" animation="none" />)
    expect(root()).toHaveAttribute('data-animation', 'none')
    expect(root().className).not.toContain('animate-luca')
  })

  it('prefers-reduced-motion: queda quieta, sin clases de animación', () => {
    mockReducedMotion(true)
    const { container } = render(<LucaMascot state="loading" animation="walk" />)
    const root = container.querySelector('[data-luca]') as HTMLElement
    expect(root).toHaveAttribute('data-motion', 'reduced')
    expect(root).toHaveAttribute('data-animation', 'none')
    expect(root.className).not.toContain('animate-luca')
  })

  it('motion="reduced" fuerza la versión quieta aunque el sistema permita animar', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaMascot state="happy" animation="enter" motion="reduced" />)
    expect(container.querySelector('[data-luca]')).toHaveAttribute('data-animation', 'none')
  })

  it('chip: círculo claro con la imagen más chica para no tocar los bordes', () => {
    const { container } = render(<LucaMascot state="happy" size="sm" chip />)
    const root = container.querySelector('[data-luca]') as HTMLElement
    expect(root.style.width).toBe(`${LUCA_SIZES.sm}px`)
    expect(root.style.height).toBe(`${LUCA_SIZES.sm}px`)
    expect(root.className).toContain('rounded-pill')
    expect((container.querySelector('img') as HTMLImageElement).style.height).toBe(`${Math.round(LUCA_SIZES.sm * 0.84)}px`)
  })

  it('no captura gestos ni foco: no es interactiva', () => {
    const { container } = render(<LucaMascot state="happy" />)
    expect(container.querySelector('button, a, [tabindex]')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('draggable', 'false')
  })
})

describe('escenas de Luca', () => {
  it('LucaLoader avisa que está cargando y Luca camina', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaLoader label="Cargando movimientos" />)
    const status = screen.getByRole('status', { name: 'Cargando movimientos' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('[data-luca]')).toHaveAttribute('data-luca', 'loading')
    expect(container.querySelector('[data-luca]')).toHaveAttribute('data-animation', 'walk')
  })

  it('LucaLoader con movimiento reducido: quieta', () => {
    mockReducedMotion(true)
    const { container } = render(<LucaLoader label="Cargando" />)
    expect(container.querySelector('[data-luca]')).toHaveAttribute('data-animation', 'none')
  })

  it('LucaEmptyState muestra la pose y el texto', () => {
    const { container } = render(
      <LucaEmptyState state="sleeping" title="Todavía no hay movimientos">
        Registrá el primero.
      </LucaEmptyState>,
    )
    expect(container.querySelector('[data-luca]')).toHaveAttribute('data-luca', 'sleeping')
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(screen.getByText('Registrá el primero.')).toBeInTheDocument()
  })
})

describe('qué estado le toca a Luca en cada situación', () => {
  it('Inicio según el saldo', () => {
    expect(homeLuca(1)).toBe('happy')
    expect(homeLuca(0)).toBe('default')
    expect(homeLuca(-1)).toBe('thinking')
  })
  it('recordatorios: atenta con pendientes, discreta (nada) sin ninguno', () => {
    expect(remindersLuca(2)).toBe('attentive')
    expect(remindersLuca(0)).toBeNull()
  })
  it('ingreso tranquila / gasto pensativa; confirmación celebra el ingreso y calma el gasto', () => {
    expect(flowLuca('INCOME')).toBe('default')
    expect(flowLuca('EXPENSE')).toBe('thinking')
    expect(confirmedLuca('INCOME')).toBe('celebrating')
    expect(confirmedLuca('EXPENSE')).toBe('success')
  })
  it('préstamos: completo=feliz, con cuotas pendientes=pensativa', () => {
    expect(loanLuca('COMPLETED')).toBe('happy')
    expect(loanLuca('PENDING')).toBe('thinking')
    expect(loanLuca('OVERDUE')).toBe('thinking')
  })
  it('ahorros: meta cumplida celebra; si no, ahorrando', () => {
    expect(jarLuca(true)).toBe('goal')
    expect(jarLuca(false)).toBe('saving')
  })
})
