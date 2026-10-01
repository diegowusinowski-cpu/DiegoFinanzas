import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LUCA_SIZES, LucaMascot } from './LucaMascot'
import { LucaEmptyState, LucaLoader } from './LucaScenes'
import { LUCA_GREETING_MS, resetLucaGreeting, useLucaGreeting } from './greeting'
import { confirmedLuca, createdLoanLuca, flowLuca, homeLuca, jarLuca, loanLuca, remindersLuca } from './moods'
import { LUCA_POSES, POSE_IDS } from './poses'
import { preloadLuca } from './preload'
import { EXPRESSION_POSE, LUCA_EXPRESSIONS, LUCA_STATES, LUCA_STATE_SPEC } from './states'
import { LUCA_EXIT_MS, LUCA_FADE_MS } from './useLucaLife'

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

const root = (container: HTMLElement) => container.querySelector('[data-luca]') as HTMLElement

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('sistema de estados', () => {
  it('tiene todos los estados pedidos', () => {
    for (const state of [
      'welcome', 'idle', 'happy', 'celebrating', 'thinking', 'attentive', 'saving', 'lending',
      'spending', 'loading', 'success', 'error', 'sleeping', 'waving', 'walking', 'excited',
    ]) {
      expect(LUCA_STATES).toContain(state)
    }
  })

  it('cada estado apunta a una pose existente, en WebP, y a un movimiento', () => {
    for (const state of LUCA_STATES) {
      const spec = LUCA_STATE_SPEC[state]
      expect(POSE_IDS).toContain(spec.pose)
      expect(LUCA_POSES[spec.pose].src).toMatch(/\.webp$/)
      expect(spec.animation).toBeTruthy()
    }
  })

  it('los estados nuevos se distinguen por pose y/o movimiento, sin duplicar imágenes', () => {
    expect(LUCA_STATE_SPEC.waving).toMatchObject({ pose: 'wink', animation: 'wave' })
    expect(LUCA_STATE_SPEC.walking).toMatchObject({ pose: 'loading', animation: 'stroll' })
    expect(LUCA_STATE_SPEC.loading).toMatchObject({ pose: 'loading', animation: 'walk' })
    expect(LUCA_STATE_SPEC.excited).toMatchObject({ pose: 'happy', animation: 'hop' })
    expect(LUCA_STATE_SPEC.happy.pose).toBe(LUCA_STATE_SPEC.excited.pose)
    expect(LUCA_STATE_SPEC.excited.animation).not.toBe(LUCA_STATE_SPEC.happy.animation)
  })

  it('cada gesto de la cara tiene su pose', () => {
    for (const expression of LUCA_EXPRESSIONS) expect(POSE_IDS).toContain(EXPRESSION_POSE[expression])
  })
})

describe('LucaMascot', () => {
  it('cada estado se renderiza con su pose', () => {
    mockReducedMotion(true)
    for (const variant of LUCA_STATES) {
      const { container, unmount } = render(<LucaMascot variant={variant} />)
      expect(root(container)).toHaveAttribute('data-luca', variant)
      const pose = LUCA_POSES[LUCA_STATE_SPEC[variant].pose]
      expect(root(container).querySelector('img')).toHaveAttribute('src', pose.src)
      unmount()
    }
  })

  it('expression cambia la cara y conserva el movimiento del estado', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaMascot variant="spending" expression="wink" />)
    expect(root(container)).toHaveAttribute('data-pose', 'wink')
    expect(root(container)).toHaveAttribute('data-animation', LUCA_STATE_SPEC.spending.animation)
  })

  it('es decorativa por defecto: oculta para lectores de pantalla y sin texto alternativo', () => {
    const { container } = render(<LucaMascot variant="happy" />)
    expect(root(container)).toHaveAttribute('aria-hidden', 'true')
    expect(root(container).querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('con label se expone como imagen con ese nombre', () => {
    render(<LucaMascot variant="welcome" label="Luca te saluda" />)
    expect(screen.getByRole('img', { name: 'Luca te saluda' })).toBeInTheDocument()
  })

  it('nunca intercepta toques ni gestos ni recibe foco', () => {
    const { container } = render(<LucaMascot variant="happy" />)
    expect(root(container).className).toContain('pointer-events-none')
    expect(container.querySelector('button, a, [tabindex]')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('draggable', 'false')
  })

  it('tamaños predefinidos y alto libre; la proporción de la pose no se deforma', () => {
    mockReducedMotion(true)
    const { container, rerender } = render(<LucaMascot variant="idle" size="lg" />)
    const img = () => container.querySelector('img') as HTMLImageElement
    expect(img().style.height).toBe(`${LUCA_SIZES.lg}px`)
    expect(img().style.aspectRatio.replace(/\s/g, '')).toBe(`${LUCA_POSES.idle.width}/${LUCA_POSES.idle.height}`)
    rerender(<LucaMascot variant="idle" size={104} />)
    expect(img().style.height).toBe('104px')
  })

  it('position alinea dentro del contenedor', () => {
    const { container } = render(<LucaMascot position="end" />)
    expect(root(container).className).toContain('ml-auto')
  })

  it('la imagen inicial (priority) carga ya; las demás poses se cargan de forma diferida', () => {
    mockReducedMotion(true)
    const { container, rerender } = render(<LucaMascot variant="welcome" priority />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
    rerender(<LucaMascot variant="sleeping" />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })

  it('usa el movimiento del estado y se puede cambiar o apagar', () => {
    mockReducedMotion(false)
    const { container, rerender } = render(<LucaMascot variant="celebrating" delayMs={500} />)
    expect(root(container)).toHaveAttribute('data-animation', 'celebrate')
    expect(root(container).className).toContain('luca-anim-celebrate')
    expect(root(container).style.animationDelay).toBe('500ms')
    rerender(<LucaMascot variant="celebrating" animation="hop" />)
    expect(root(container).className).toContain('luca-anim-hop')
    rerender(<LucaMascot variant="celebrating" animation="none" />)
    expect(root(container)).toHaveAttribute('data-animation', 'none')
    expect(root(container).className).not.toContain('luca-anim')
  })

  it('prefers-reduced-motion: queda quieta, sin animación ni partes que se mueven', () => {
    mockReducedMotion(true)
    const { container } = render(<LucaMascot variant="welcome" priority />)
    expect(root(container)).toHaveAttribute('data-motion', 'reduced')
    expect(root(container)).toHaveAttribute('data-animation', 'none')
    expect(root(container).className).not.toContain('luca-anim')
    expect(container.querySelector('[data-luca-part]')).toBeNull()
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('motion="reduced" fuerza la versión quieta aunque el sistema permita animar', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaMascot variant="happy" motion="reduced" />)
    expect(root(container)).toHaveAttribute('data-animation', 'none')
  })

  it('chip: círculo claro con la imagen más chica para no tocar los bordes', () => {
    const { container } = render(<LucaMascot variant="happy" size="sm" chip />)
    expect(root(container).style.width).toBe(`${LUCA_SIZES.sm}px`)
    expect(root(container).className).toContain('rounded-pill')
    expect((container.querySelector('img') as HTMLImageElement).style.height).toBe(`${Math.round(LUCA_SIZES.sm * 0.84)}px`)
  })
})

describe('Luca viva (pose grande)', () => {
  it('se arma con cuerpo + cola, orejas, rayitas y párpados', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaMascot variant="welcome" priority />)
    expect(container.querySelector('[data-luca-layers="true"]')).not.toBeNull()
    const parts = Array.from(container.querySelectorAll('[data-luca-part]')).map((el) => el.getAttribute('data-luca-part'))
    expect(parts).toEqual(['tail', 'earL', 'earR', 'marks', 'lids'])
    // Los giros se hacen alrededor de la base de cada parte.
    expect((container.querySelector('[data-luca-part="tail"]') as HTMLElement).style.transformOrigin).toMatch(/%/)
  })

  it('alive={false} usa la imagen entera', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaMascot variant="welcome" alive={false} />)
    expect(container.querySelector('[data-luca-part]')).toBeNull()
  })

  it('parpadea de vez en cuando (140 ms) y no más de unas pocas veces', async () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    const { container } = render(<LucaMascot variant="welcome" priority />)
    const lids = () => container.querySelector('[data-luca-part="lids"]') as HTMLElement
    expect(lids().style.opacity).toBe('0')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100)
    })
    // En algún momento de los primeros 6 s ya parpadeó al menos una vez y volvió a abrir los ojos.
    expect(lids().style.opacity).toBe('0')
    let closedSeen = false
    for (let i = 0; i < 400; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      if (lids().style.opacity === '1') closedSeen = true
    }
    expect(closedSeen).toBe(true)
    // Tras el tope de parpadeos queda quieta.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    for (let i = 0; i < 100; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(lids().style.opacity).toBe('0')
    }
  })
})

describe('transiciones', () => {
  it('cambiar de estado hace un fundido entre poses y después deja solo la nueva', async () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    const { container, rerender } = render(<LucaMascot variant="idle" />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    rerender(<LucaMascot variant="happy" />)
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(container.querySelector('.luca-fade-out')).toHaveAttribute('src', LUCA_POSES.idle.src)
    expect(container.querySelector('.luca-fade-in')).toHaveAttribute('src', LUCA_POSES.happy.src)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LUCA_FADE_MS + 20)
    })
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')).toHaveAttribute('src', LUCA_POSES.happy.src)
  })

  it('con movimiento reducido el cambio de estado es instantáneo', () => {
    mockReducedMotion(true)
    const { container, rerender } = render(<LucaMascot variant="idle" />)
    rerender(<LucaMascot variant="happy" />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')).toHaveAttribute('src', LUCA_POSES.happy.src)
  })

  it('aparece y desaparece con salida suave', async () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    const { container, rerender } = render(<LucaMascot variant="attentive" show={false} />)
    expect(root(container)).toBeNull()
    rerender(<LucaMascot variant="attentive" show />)
    expect(root(container)).toHaveAttribute('data-presence', 'present')
    rerender(<LucaMascot variant="attentive" show={false} />)
    expect(root(container)).toHaveAttribute('data-presence', 'leaving')
    expect(root(container)).toHaveAttribute('data-animation', 'exit')
    expect(root(container)).toHaveAttribute('aria-hidden', 'true')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LUCA_EXIT_MS + 20)
    })
    expect(root(container)).toBeNull()
  })

  it('con movimiento reducido desaparece al instante', async () => {
    mockReducedMotion(true)
    vi.useFakeTimers()
    const { container, rerender } = render(<LucaMascot show />)
    rerender(<LucaMascot show={false} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5)
    })
    expect(root(container)).toBeNull()
  })

  it('las transiciones duran entre 250 y 500 ms', () => {
    for (const ms of [LUCA_EXIT_MS, LUCA_FADE_MS]) {
      expect(ms).toBeGreaterThanOrEqual(250)
      expect(ms).toBeLessThanOrEqual(500)
    }
  })
})

describe('saludo y precarga', () => {
  it('saluda solo la primera vez de la sesión y dura un momento', async () => {
    vi.useFakeTimers()
    resetLucaGreeting()
    const first = renderHook(() => useLucaGreeting())
    expect(first.result.current).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LUCA_GREETING_MS + 20)
    })
    expect(first.result.current).toBe(false)
    first.unmount()
    expect(renderHook(() => useLucaGreeting()).result.current).toBe(false)
  })

  it('precarga las poses una sola vez, sin bloquear', async () => {
    vi.useFakeTimers()
    const created: string[] = []
    class FakeImage {
      decoding = ''
      set src(value: string) {
        created.push(value)
      }
    }
    vi.stubGlobal('Image', FakeImage)
    preloadLuca(['celebrating', 'success'])
    expect(created).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(created).toEqual([LUCA_POSES.celebrating.src, LUCA_POSES.success.src])
    preloadLuca(['celebrating'])
    await vi.advanceTimersByTimeAsync(5000)
    expect(created).toHaveLength(2)
  })
})

describe('escenas de Luca', () => {
  it('LucaLoader avisa que está cargando y Luca camina', () => {
    mockReducedMotion(false)
    const { container } = render(<LucaLoader label="Cargando movimientos" />)
    const status = screen.getByRole('status', { name: 'Cargando movimientos' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(root(container)).toHaveAttribute('data-luca', 'loading')
    expect(root(container)).toHaveAttribute('data-animation', 'walk')
  })

  it('LucaLoader con movimiento reducido: quieta', () => {
    mockReducedMotion(true)
    const { container } = render(<LucaLoader label="Cargando" />)
    expect(root(container)).toHaveAttribute('data-animation', 'none')
  })

  it('LucaEmptyState muestra la pose y el texto', () => {
    const { container } = render(
      <LucaEmptyState variant="sleeping" title="Todavía no hay movimientos">
        Registrá el primero.
      </LucaEmptyState>,
    )
    expect(root(container)).toHaveAttribute('data-luca', 'sleeping')
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(screen.getByText('Registrá el primero.')).toBeInTheDocument()
  })
})

describe('qué estado le toca a Luca en cada situación', () => {
  it('Inicio según el saldo', () => {
    expect(homeLuca(1)).toBe('happy')
    expect(homeLuca(0)).toBe('idle')
    expect(homeLuca(-1)).toBe('thinking')
  })
  it('recordatorios: atenta con pendientes, sin pendientes no aparece', () => {
    expect(remindersLuca(2)).toBe('attentive')
    expect(remindersLuca(0)).toBeNull()
  })
  it('ingreso tranquila; gasto pensativa y luego con la bolsa; confirmación celebra el ingreso y calma el gasto', () => {
    expect(flowLuca('INCOME')).toBe('idle')
    expect(flowLuca('INCOME', 'amount')).toBe('idle')
    expect(flowLuca('EXPENSE')).toBe('thinking')
    expect(flowLuca('EXPENSE', 'amount')).toBe('spending')
    expect(confirmedLuca('INCOME')).toBe('celebrating')
    expect(confirmedLuca('EXPENSE')).toBe('success')
  })
  it('préstamos: nuevo=lending, completo=feliz, cuotas pendientes=atenta', () => {
    expect(createdLoanLuca).toBe('lending')
    expect(loanLuca('COMPLETED')).toBe('happy')
    expect(loanLuca('PENDING')).toBe('attentive')
    expect(loanLuca('UPCOMING')).toBe('attentive')
    expect(loanLuca('OVERDUE')).toBe('attentive')
  })
  it('ahorros: meta cumplida celebra; si no, ahorrando', () => {
    expect(jarLuca(true)).toBe('goal')
    expect(jarLuca(false)).toBe('saving')
  })
})
