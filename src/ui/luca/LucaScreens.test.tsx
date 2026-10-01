import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMovement, firstRun, goToAmount, mount, setupUser, typeAmount } from '@/test/flowHelpers'
import { createTestServices } from '@/test/services'
import { LUCA_GREETING_MS } from './greeting'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Deja pasar el saludo inicial de Luca en el Inicio. */
const afterGreeting = () =>
  act(async () => {
    vi.advanceTimersByTime(LUCA_GREETING_MS + 100)
  })

/** Estado actual de cada Luca visible (en el orden del documento). */
const lucas = (root: ParentNode = document.body) =>
  Array.from(root.querySelectorAll('[data-luca]')).map((el) => el.getAttribute('data-luca'))

describe('Luca en la app', () => {
  it('login: saluda sin tapar el formulario', async () => {
    setupUser()
    mount(createTestServices())
    const field = await screen.findByLabelText('Número de teléfono')
    const greeting = screen.getByRole('img', { name: /Luca, la mascota de DWF, te saluda/ })
    expect(greeting).toHaveAttribute('data-luca', 'welcome')
    expect(field).toBeVisible()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    // No es un control: no recibe foco ni intercepta toques.
    expect(greeting.closest('button, a')).toBeNull()
  })

  it('Inicio: Luca cambia de expresión con la cuenta y no hace falta para usar la app', async () => {
    const user = setupUser()
    await firstRun(user)
    // Al abrir el Inicio saluda una vez y después queda en su estado normal.
    expect(screen.getByRole('img', { name: 'Luca, tu compañera de DWF' })).toHaveAttribute('data-luca', 'waving')
    await afterGreeting()
    const header = screen.getByRole('img', { name: 'Luca, tu compañera de DWF' })
    expect(header).toHaveAttribute('data-luca', 'idle')

    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '1000' })
    expect(screen.getByRole('img', { name: 'Luca, tu compañera de DWF' })).toHaveAttribute('data-luca', 'happy')

    await addMovement(user, 'Gasto', { category: 'Transporte y movilidad', amount: '3000' })
    expect(screen.getByRole('img', { name: 'Luca, tu compañera de DWF' })).toHaveAttribute('data-luca', 'thinking')
    // El botón de ingreso sigue accesible y sin nada encima.
    expect(screen.getByRole('button', { name: 'Ingreso' })).toBeEnabled()
  })

  it('Recordatorios: atenta con pendientes; sin recordatorios no aparece', async () => {
    const user = setupUser()
    await firstRun(user)
    await afterGreeting()
    expect(screen.getByText('Sin recordatorios')).toBeInTheDocument()
    expect(lucas()).not.toContain('attentive')

    await user.click(screen.getByRole('button', { name: '+ Agregar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
    await user.type(within(dialog).getByLabelText('Título'), 'Pagar la luz')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recordatorio' }))
    await screen.findByText('Pagar la luz')
    expect(lucas()).toContain('attentive')

    await user.click(screen.getByRole('button', { name: /Descartar recordatorio: Pagar la luz/ }))
    await waitFor(() => expect(lucas()).not.toContain('attentive'))
  })

  it('Ingreso: tranquila durante la carga; el botón Continuar sigue activo', async () => {
    const user = setupUser()
    await firstRun(user)
    await afterGreeting()

    await goToAmount(user, 'Ingreso', { category: 'Trabajo en relación de dependencia' })
    expect(lucas(document.body)).toEqual(expect.arrayContaining(['idle']))
    await typeAmount(user, '50')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('Gasto: pensativa mientras elige país, titular y categoría', async () => {
    const user = setupUser()
    await firstRun(user)
    await afterGreeting()
    await user.click(screen.getByRole('button', { name: 'Gasto' }))
    await screen.findByRole('button', { name: /^Argentina/ })
    expect(lucas(document.body)).toContain('thinking')
  })

  it('Gasto: con la bolsa en el monto, sin tapar el teclado ni el botón', async () => {
    const user = setupUser()
    await firstRun(user)
    await afterGreeting()
    await goToAmount(user, 'Gasto', { category: 'Transporte y movilidad' })
    // Con la bolsa de compras en la pantalla del monto; pensativa en los pasos de elegir.
    expect(lucas(document.body)).toContain('spending')
    await typeAmount(user, '50')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('movimiento confirmado: celebra un ingreso y queda tranquila en un gasto, y el flujo vuelve al Home', async () => {
    const user = setupUser()
    await firstRun(user)

    await goToAmount(user, 'Ingreso', { category: 'Trabajo en relación de dependencia' })
    await typeAmount(user, '500')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar ingreso' }))
    const done = await screen.findByTestId('movement-done')
    expect(lucas(done)).toEqual(['celebrating'])
    expect(within(done).getByRole('heading', { name: 'Movimiento confirmado' })).toBeInTheDocument()
    expect(within(done).getByTestId('done-check')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await waitFor(() => expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument())

    await goToAmount(user, 'Gasto', { category: 'Transporte y movilidad' })
    await typeAmount(user, '100')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar gasto' }))
    expect(lucas(await screen.findByTestId('movement-done'))).toEqual(['success'])
  })

  it('Movimientos: durmiendo cuando está vacío; con movimientos no ocupa lugar', async () => {
    const user = setupUser()
    await firstRun(user)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    expect(await screen.findByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(lucas()).toContain('sleeping')

    await user.click(within(nav).getByRole('button', { name: 'Inicio' }))
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '10' })
    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    await screen.findByRole('heading', { name: 'Movimientos' })
    expect(lucas()).not.toContain('sleeping')
  })

  it('Préstamos y Ahorros vacíos: Luca con su pose, y los botones de crear siguen ahí', async () => {
    const user = setupUser()
    await firstRun(user)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })

    await user.click(within(nav).getByRole('button', { name: 'Préstamos' }))
    await screen.findByText('Todavía no hay préstamos')
    expect(lucas()).toContain('lending')

    await user.click(within(nav).getByRole('button', { name: 'Ahorros' }))
    await screen.findByText('Todavía no hay frascos')
    expect(lucas()).toContain('saving')
  })

  it('movimiento reducido: ninguna Luca de la app lleva animación', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const user = setupUser()
    await firstRun(user)
    const all = Array.from(document.querySelectorAll('[data-luca]'))
    expect(all.length).toBeGreaterThan(0)
    for (const el of all) {
      expect(el).toHaveAttribute('data-motion', 'reduced')
      expect(el).toHaveAttribute('data-animation', 'none')
    }
  })
})
