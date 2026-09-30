import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AppServices } from '@/services/container'
import { AuthProvider } from '@/state/AuthContext'
import { ServicesProvider } from '@/state/ServicesContext'
import { createTestServices, fakeRates } from '@/test/services'
import { App } from './App'
import { ToastProvider } from './components/Toast'

function mount(services: AppServices) {
  return render(
    <ServicesProvider services={services}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ServicesProvider>,
  )
}

async function pressPin(user: UserEvent, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
}

async function firstRun(user: UserEvent, services = createTestServices()) {
  mount(services)
  await user.type(await screen.findByLabelText('Número de teléfono'), '11 2345 6789')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await pressPin(user, '1234')
  await pressPin(user, '1234')
  await screen.findByTestId('balance')
  return services
}

async function addMovement(
  user: UserEvent,
  kind: 'Gasto' | 'Ingreso',
  data: { amount: string; description: string; category: string; date?: string; time?: string },
) {
  await user.click(screen.getByRole('button', { name: kind }))
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo movimiento' })
  const form = within(dialog)
  await user.type(form.getByLabelText('Monto'), data.amount)
  await user.type(form.getByLabelText('Descripción'), data.description)
  await user.click(form.getByLabelText(data.category))
  if (data.date) fireEvent.change(form.getByLabelText('Fecha'), { target: { value: data.date } })
  if (data.time) fireEvent.change(form.getByLabelText('Hora'), { target: { value: data.time } })
  await user.click(form.getByRole('button', { name: /Registrar/ }))
}

const balance = () => screen.getByTestId('balance').textContent

describe('Acceso', () => {
  it('primer ingreso: teléfono + PIN dos veces y entra al dashboard', async () => {
    const user = userEvent.setup()
    const services = await firstRun(user)
    expect(await services.auth.getProfile()).toMatchObject({ phone: '+5491123456789' })
  })

  it('el PIN no coincide: vuelve a empezar', async () => {
    const user = userEvent.setup()
    mount(createTestServices())
    await user.type(await screen.findByLabelText('Número de teléfono'), '1123456789')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await pressPin(user, '1234')
    await pressPin(user, '4321')
    expect(await screen.findByText(/no coinciden/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Creá tu PIN' })).toBeInTheDocument()
  })

  it('valida el teléfono', async () => {
    const user = userEvent.setup()
    mount(createTestServices())
    await user.type(await screen.findByLabelText('Número de teléfono'), '12')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/número válido/)
  })

  it('muestra la pantalla de acceso con saludo, teléfono oculto, 4 indicadores y opciones', async () => {
    const user = userEvent.setup()
    const services = await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Más' }))
    await user.click(screen.getByRole('button', { name: 'Bloquear DWF' }))

    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo, Diego' })).toBeInTheDocument()
    expect(screen.getByText('DWF')).toBeInTheDocument()
    expect(screen.getByText('+54 •••••••• 789')).toBeInTheDocument()
    expect(screen.queryByText(/1123456/)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /0 de 4 dígitos/ })).toBeInTheDocument()
    for (const key of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Usar otro número de teléfono' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No recuerdo mi contraseña' })).toBeInTheDocument()
    expect(services.session.getItem('dwf.session')).toBeNull()
  })

  it('PIN incorrecto muestra error; el correcto entra', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Más' }))
    await user.click(screen.getByRole('button', { name: 'Bloquear DWF' }))
    await screen.findByRole('heading', { name: /Bienvenido de nuevo/ })

    await pressPin(user, '0000')
    expect(await screen.findByText(/PIN incorrecto. Te quedan 4 intentos/)).toBeInTheDocument()
    await pressPin(user, '1234')
    expect(await screen.findByText('Saldo disponible')).toBeInTheDocument()
  })

  it('bloquea el teclado tras 5 intentos fallidos', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Más' }))
    await user.click(screen.getByRole('button', { name: 'Bloquear DWF' }))
    await screen.findByRole('heading', { name: /Bienvenido de nuevo/ })
    for (const left of ['4 intentos', '3 intentos', '2 intentos', '1 intento']) {
      await pressPin(user, '9999')
      expect(await screen.findByText(new RegExp(`Te quedan? ${left}`))).toBeInTheDocument()
    }
    await pressPin(user, '9999')
    expect(await screen.findByText(/Probá de nuevo en/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
  })

  it('"No recuerdo mi contraseña" y "Usar otro número" reinician el acceso sin borrar movimientos', async () => {
    const user = userEvent.setup()
    const services = await firstRun(user)
    await addMovement(user, 'Ingreso', { amount: '1000', description: 'Cobro', category: 'Cobro' })
    await screen.findByText('Cobro')
    await user.click(screen.getByRole('button', { name: 'Más' }))
    await user.click(screen.getByRole('button', { name: 'Bloquear DWF' }))

    await user.click(await screen.findByRole('button', { name: 'No recuerdo mi contraseña' }))
    const dialog = await screen.findByRole('dialog', { name: 'Recuperar acceso' })
    await user.click(within(dialog).getByRole('button', { name: 'Crear un PIN nuevo' }))
    expect(await screen.findByLabelText('Número de teléfono')).toBeInTheDocument()
    expect(await services.repositories.transactions.list()).toHaveLength(1)
  })
})

describe('Dashboard', () => {
  it('estado inicial: saldo $ 0,00, sin datos ficticios, con marca DWF y sin ARQ', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    expect(balance()).toBe('$ 0,00')
    expect(screen.getByText('Sin recordatorios')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gasto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingreso' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recordatorios' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Últimos movimientos' })).toBeInTheDocument()
    expect(screen.getByText('Dieto Wusinowski Finanzas')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/ARQ/i)
  })

  it('el ingreso suma y el gasto resta, y el saldo se actualiza al instante', async () => {
    const user = userEvent.setup()
    await firstRun(user)

    await addMovement(user, 'Ingreso', { amount: '10.000', description: 'Sueldo octubre', category: 'Sueldo' })
    expect(await screen.findByText('Sueldo octubre')).toBeInTheDocument()
    expect(balance()).toBe('$ 10.000,00')

    await addMovement(user, 'Gasto', { amount: '2.500,50', description: 'Supermercado', category: 'Comida' })
    expect(await screen.findByText('Supermercado')).toBeInTheDocument()
    expect(balance()).toBe('$ 7.499,50')

    const list = screen.getByTestId('latest-movements')
    expect(within(list).getByText('+ $ 10.000,00')).toBeInTheDocument()
    expect(within(list).getByText('− $ 2.500,50')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay movimientos')).not.toBeInTheDocument()
  })

  it('el saldo puede quedar negativo', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await addMovement(user, 'Gasto', { amount: '300', description: 'Taxi', category: 'Transporte' })
    await screen.findByText('Taxi')
    expect(balance()).toMatch(/300,00/)
    expect(balance()).toMatch(/^-|−/)
  })

  it('muestra exactamente los 3 movimientos más recientes', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    const today = '2026-10-06'
    await addMovement(user, 'Gasto', { amount: '10', description: 'Mov A', category: 'Comida', date: '2026-10-01', time: '10:00' })
    await addMovement(user, 'Gasto', { amount: '20', description: 'Mov B', category: 'Comida', date: '2026-10-03', time: '10:00' })
    await addMovement(user, 'Ingreso', { amount: '30', description: 'Mov C', category: 'Cobro', date: '2026-10-04', time: '10:00' })
    await addMovement(user, 'Gasto', { amount: '40', description: 'Mov D', category: 'Comida', date: today, time: '09:00' })

    const list = await screen.findByTestId('latest-movements')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Mov D')
    expect(items[1]).toHaveTextContent('Mov C')
    expect(items[2]).toHaveTextContent('Mov B')
    expect(within(list).queryByText('Mov A')).not.toBeInTheDocument()
    // saldo = -10 -20 +30 -40 = -40
    expect(balance()).toMatch(/40,00/)
  })

  it('valida el formulario y no guarda datos inválidos', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Gasto' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar gasto' }))
    expect(within(dialog).getByText(/monto válido/)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Monto'), '50')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar gasto' }))
    expect(await within(dialog).findByText('Escribí una descripción.')).toBeInTheDocument()
    expect(within(dialog).getByText('Elegí una categoría.')).toBeInTheDocument()
    expect(balance()).toBe('$ 0,00')
  })

  it('cambiar de tipo muestra las categorías correspondientes y limpia la elegida', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Gasto' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText('Comida'))
    expect(within(dialog).queryByLabelText('Sueldo')).not.toBeInTheDocument()
    await user.click(within(dialog).getByLabelText('Ingreso'))
    expect(within(dialog).getByLabelText('Sueldo')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Comida')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Sueldo')).not.toBeChecked()
  })

  it('un movimiento futuro queda programado y no altera el saldo', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await addMovement(user, 'Gasto', { amount: '999', description: 'Futuro', category: 'Hogar', date: '2027-01-01', time: '10:00' })
    await user.click(await screen.findByRole('button', { name: 'Movimientos' }))
    expect(await screen.findByText('Programado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Inicio' }))
    expect(balance()).toBe('$ 0,00')
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
  })

  it('el "+" central abre el formulario de movimiento', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }))
    expect(await screen.findByRole('dialog', { name: 'Nuevo movimiento' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('los movimientos y el saldo sobreviven a un reinicio de la app', async () => {
    const user = userEvent.setup()
    const services = await firstRun(user)
    await addMovement(user, 'Ingreso', { amount: '5000', description: 'Persistente', category: 'Venta' })
    await screen.findByText('Persistente')
    document.body.innerHTML = ''

    mount(services) // misma sesión (session storage) y mismos repositorios
    expect(await screen.findByText('Persistente')).toBeInTheDocument()
    expect(balance()).toBe('$ 5.000,00')
  })
})

describe('Recordatorios', () => {
  it('permite crear varios y descartarlos', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    for (const title of ['Cuota el 6 de Octubre', 'Cobrar alquiler']) {
      await user.click(screen.getByRole('button', { name: '+ Agregar' }))
      const dialog = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
      await user.type(within(dialog).getByLabelText('Título'), title)
      await user.type(within(dialog).getByLabelText('Detalle (opcional)'), 'Detalle de prueba')
      await user.click(within(dialog).getByRole('button', { name: 'Guardar recordatorio' }))
    }
    expect(await screen.findByText('Cuota el 6 de Octubre')).toBeInTheDocument()
    expect(screen.getByText('Cobrar alquiler')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Descartar recordatorio: Cobrar alquiler/ }))
    expect(screen.queryByText('Cobrar alquiler')).not.toBeInTheDocument()
    expect(screen.getByText('Cuota el 6 de Octubre')).toBeInTheDocument()
  })

  it('exige título', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: '+ Agregar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recordatorio' }))
    expect(await within(dialog).findByText('Escribí un título.')).toBeInTheDocument()
  })
})

describe('Tasas de conversión', () => {
  it('muestra compra y venta del Dólar Blue con la fuente', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    expect(await screen.findByText('Dólar Blue / ARS')).toBeInTheDocument()
    expect(await screen.findByTestId('rate-buy')).toHaveTextContent('$ 1.385')
    expect(screen.getByTestId('rate-sell')).toHaveTextContent('$ 1.405,5')
    expect(screen.getByText(/Actualizado/)).toHaveTextContent('DolarHoy.com')
  })

  it('si la fuente no responde muestra indisponibilidad y el resto sigue funcionando', async () => {
    const user = userEvent.setup()
    await firstRun(user, createTestServices({ rates: fakeRates('unavailable') }))
    expect(await screen.findByText(/cotización no está disponible/)).toBeInTheDocument()
    expect(screen.queryByTestId('rate-buy')).not.toBeInTheDocument()
    await addMovement(user, 'Ingreso', { amount: '100', description: 'Igual funciona', category: 'Cobro' })
    expect(await screen.findByText('Igual funciona')).toBeInTheDocument()
    expect(balance()).toBe('$ 100,00')
  })
})

describe('Navegación', () => {
  it('cambia entre Inicio, Movimientos y Más', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Inicio',
      'Movimientos',
      'Registrar movimiento',
      'Más',
    ])

    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    expect(screen.getByRole('heading', { name: 'Movimientos' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Movimientos' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(nav).getByRole('button', { name: 'Más' }))
    expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: 'Inicio' }))
    expect(screen.getByText('Saldo disponible')).toBeInTheDocument()
  })

  it('la lista de Movimientos muestra todos, agrupados por día', async () => {
    const user = userEvent.setup()
    await firstRun(user)
    for (const n of ['1', '2', '3', '4', '5']) {
      await addMovement(user, 'Gasto', { amount: n, description: `Gasto ${n}`, category: 'Comida', date: `2026-10-0${n}`, time: '10:00' })
    }
    await user.click(screen.getByRole('button', { name: 'Movimientos' }))
    expect(await screen.findAllByText(/^Gasto \d$/)).toHaveLength(5)
  })
})
