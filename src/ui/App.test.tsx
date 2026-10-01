import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMovement, balance, firstRun, mount, pressPin, setupUser } from '@/test/flowHelpers'
import type { AppServices } from '@/services/container'
import { MemoryStorage } from '@/data/storage'
import { CachingRateProvider } from '@/services/rateCache'
import { RateUnavailableError } from '@/services/rates'
import { SAMPLE_RATE, createTestServices, fakeRates } from '@/test/services'

afterEach(() => {
  vi.useRealTimers()
})

/** Vuelve a abrir la app con una sesión nueva (sin sesión activa: pide el PIN). */
function reopenLocked(services: AppServices) {
  services.session.removeItem('dwf.session')
  document.body.innerHTML = ''
  mount(services)
}

describe('Acceso', () => {
  it('primer ingreso: teléfono + PIN dos veces y entra al dashboard', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    expect(await services.auth.getProfile()).toMatchObject({ phone: '+5491123456789' })
  })

  it('el PIN no coincide: vuelve a empezar', async () => {
    const user = setupUser()
    mount(createTestServices())
    await user.type(await screen.findByLabelText('Número de teléfono'), '1123456789')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await pressPin(user, '1234')
    await pressPin(user, '4321')
    expect(await screen.findByText(/no coinciden/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Creá tu PIN' })).toBeInTheDocument()
  })

  it('valida el teléfono', async () => {
    const user = setupUser()
    mount(createTestServices())
    await user.type(await screen.findByLabelText('Número de teléfono'), '12')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/número válido/)
  })

  it('muestra la pantalla de acceso con saludo, teléfono oculto, 4 indicadores y opciones', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    reopenLocked(services)

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
    const user = setupUser()
    const services = await firstRun(user)
    reopenLocked(services)
    await screen.findByRole('heading', { name: /Bienvenido de nuevo/ })

    await pressPin(user, '0000')
    expect(await screen.findByText(/PIN incorrecto. Te quedan 4 intentos/)).toBeInTheDocument()
    await pressPin(user, '1234')
    expect(await screen.findByTestId('balance')).toBeInTheDocument()
  })

  it('bloquea el teclado tras 5 intentos fallidos', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    reopenLocked(services)
    await screen.findByRole('heading', { name: /Bienvenido de nuevo/ })
    for (const left of ['4 intentos', '3 intentos', '2 intentos', '1 intento']) {
      await pressPin(user, '9999')
      expect(await screen.findByText(new RegExp(`Te quedan? ${left}`))).toBeInTheDocument()
    }
    await pressPin(user, '9999')
    expect(await screen.findByText(/Probá de nuevo en/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
  })

  it('"No recuerdo mi contraseña" reinicia el acceso sin borrar movimientos', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '1000', concept: 'Cobro' })
    await screen.findByText('Cobro')
    reopenLocked(services)

    await user.click(await screen.findByRole('button', { name: 'No recuerdo mi contraseña' }))
    const dialog = await screen.findByRole('dialog', { name: 'Recuperar acceso' })
    await user.click(within(dialog).getByRole('button', { name: 'Crear un PIN nuevo' }))
    expect(await screen.findByLabelText('Número de teléfono')).toBeInTheDocument()
    expect(await services.repositories.transactions.list()).toHaveLength(1)
  })
})

describe('Dashboard', () => {
  it('estado inicial: saldo $ 0,00, sin datos ficticios, con marca DWF y sin ARQ', async () => {
    const user = setupUser()
    await firstRun(user)
    expect(balance()).toBe('$ 0,00')
    expect(screen.getByText('Sin recordatorios')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gasto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingreso' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recordatorios' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Últimos movimientos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Últimos servicios' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/ARQ/i)
  })

  it('cabecera de cuenta: sin rótulo visible, ARS • Datos de cuenta, y acciones Ingreso | Gasto', async () => {
    const user = setupUser()
    await firstRun(user)
    expect(screen.getByText('ARS • Datos de cuenta')).toBeInTheDocument()
    expect(screen.getByText('Saldo disponible')).toHaveClass('sr-only')
    const actions = screen.getByRole('region', { name: 'Acciones principales' })
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ingreso', 'Gasto'])
  })

  it('el ingreso suma y el gasto resta, y el saldo se actualiza al volver al Home', async () => {
    const user = setupUser()
    await firstRun(user)

    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '10000', concept: 'Sueldo octubre' })
    expect(await screen.findByText('Sueldo octubre')).toBeInTheDocument()
    expect(balance()).toBe('$ 10.000,00')

    await addMovement(user, 'Gasto', { category: 'Transporte y movilidad', amount: '2500,5', concept: 'Colectivo' })
    expect(await screen.findByText('Colectivo')).toBeInTheDocument()
    expect(balance()).toBe('$ 7.499,50')

    const list = screen.getByTestId('latest-movements')
    expect(within(list).getByText('+ $ 10.000,00')).toBeInTheDocument()
    expect(within(list).getByText('− $ 2.500,50')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay movimientos')).not.toBeInTheDocument()
  })

  it('sin concepto, el movimiento se llama como su categoría', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Gasto', { category: 'Suscripciones y tecnología', amount: '900' })
    const list = screen.getByTestId('latest-movements')
    expect(within(list).getByText('Suscripciones y tecnología')).toBeInTheDocument()
  })

  it('el saldo puede quedar negativo', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Gasto', { category: 'Transporte y movilidad', amount: '300', concept: 'Taxi' })
    await screen.findByText('Taxi')
    expect(balance()).toMatch(/300,00/)
    expect(balance()).toMatch(/^-|−/)
  })

  it('muestra exactamente los 3 movimientos más recientes', async () => {
    const user = setupUser()
    await firstRun(user)
    const food = { category: 'Transporte y movilidad' }
    await addMovement(user, 'Gasto', { ...food, amount: '10', concept: 'Mov A', date: '2026-10-01' })
    await addMovement(user, 'Gasto', { ...food, amount: '20', concept: 'Mov B', date: '2026-10-03' })
    await addMovement(user, 'Ingreso', { category: 'Préstamos', amount: '30', concept: 'Mov C', date: '2026-10-04' })
    await addMovement(user, 'Gasto', { ...food, amount: '40', concept: 'Mov D', date: '2026-10-05' })

    const list = await screen.findByTestId('latest-movements')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Mov D')
    expect(items[1]).toHaveTextContent('Mov C')
    expect(items[2]).toHaveTextContent('Mov B')
    expect(within(list).queryByText('Mov A')).not.toBeInTheDocument()
    expect(balance()).toMatch(/40,00/) // -10 -20 +30 -40
  })

  it('un movimiento futuro queda programado y no altera el saldo', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Gasto', { category: 'Salidas y ocio', amount: '999', concept: 'Futuro', date: '2027-01-01' })
    await user.click(await screen.findByRole('button', { name: 'Movimientos' }))
    expect(await screen.findByText('Programado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Inicio' }))
    expect(balance()).toBe('$ 0,00')
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
  })

  it('el "+" central pregunta Ingreso o Gasto y abre el flujo', async () => {
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }))
    const chooser = await screen.findByRole('dialog', { name: 'Nuevo movimiento' })
    expect(within(chooser).queryByText(/préstamo/i)).not.toBeInTheDocument()
    await user.click(within(chooser).getByRole('button', { name: /^Gasto/ }))
    expect(await screen.findByRole('heading', { name: 'Elegí el país' })).toBeInTheDocument()
  })

  it('el "+" se puede cerrar con Escape', async () => {
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('los movimientos y el saldo sobreviven a un reinicio de la app', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await addMovement(user, 'Ingreso', { category: 'Ventas ocasionales o emprendimiento', amount: '5000', concept: 'Persistente' })
    await screen.findByText('Persistente')
    document.body.innerHTML = ''

    mount(services) // misma sesión (session storage) y mismos repositorios
    expect(await screen.findByText('Persistente')).toBeInTheDocument()
    expect(balance()).toBe('$ 5.000,00')
  })
})

describe('Recordatorios', () => {
  it('permite crear varios y descartarlos', async () => {
    const user = setupUser()
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
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: '+ Agregar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recordatorio' }))
    expect(await within(dialog).findByText('Escribí un título.')).toBeInTheDocument()
  })
})

describe('Inicio: saldo en pesos y dólares', () => {
  const usd = () => screen.getByTestId('balance-usd')

  it('muestra solo Recordatorios, Últimos movimientos y Últimos servicios, en ese orden, sin tasas', async () => {
    const user = setupUser()
    await firstRun(user)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Saldo disponible', 'Recordatorios', 'Últimos movimientos', 'Últimos servicios'])
    expect(screen.queryByText(/Tasas de conversión/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('rate-buy')).not.toBeInTheDocument()
    expect(screen.queryByText('Dieto Wusinowski Finanzas')).not.toBeInTheDocument()
  })

  it('la página principal es el saldo en pesos y hay un indicador para deslizar al dólar', async () => {
    const user = setupUser()
    await firstRun(user)
    expect(screen.getByTestId('balance')).toHaveTextContent('$ 0,00')
    const group = screen.getByRole('group', { name: 'Elegir moneda' })
    expect(within(group).getByRole('button', { name: 'Saldo en pesos' })).toHaveAttribute('aria-current', 'true')
    expect(within(group).getByRole('button', { name: 'Saldo en dólares' })).not.toHaveAttribute('aria-current')
    await user.click(within(group).getByRole('button', { name: 'Saldo en dólares' }))
    expect(within(group).getByRole('button', { name: 'Saldo en dólares' })).toHaveAttribute('aria-current', 'true')
    await user.click(within(group).getByRole('button', { name: 'Saldo en pesos' }))
    expect(within(group).getByRole('button', { name: 'Saldo en pesos' })).toHaveAttribute('aria-current', 'true')
  })

  it('el saldo en USD sale de los pesos y la cotización venta disponible (sin valores fijos)', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '14055', concept: 'Sueldo' })
    expect(balance()).toBe('$ 14.055,00')
    // SAMPLE_RATE: venta $1.405,5 → 14.055 / 1.405,5 = 10 dólares.
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 10,00'))
  })

  it('usa la cotización que entrega la fuente configurada: otra cotización, otro resultado', async () => {
    const user = setupUser()
    const rates = { getUsdBlue: async () => ({ ...SAMPLE_RATE, sell: 2000 }) }
    await firstRun(user, createTestServices({ rates }))
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '10000', concept: 'Sueldo' })
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 5,00'))
  })

  it('suma lo registrado en dólares al equivalente de los pesos', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '1405,5', concept: 'Pesos' })
    await addMovement(user, 'Ingreso', { country: 'Estados Unidos', category: 'Trabajo en relación de dependencia', amount: '5', concept: 'Dólares' })
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 6,00'))
    expect(balance()).toBe('$ 1.405,50')
  })

  it('sin cotización disponible el USD dice "No disponible" y no inventa valores', async () => {
    const user = setupUser()
    await firstRun(user, createTestServices({ rates: fakeRates('unavailable') }))
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '1000', concept: 'Sueldo' })
    await waitFor(() => expect(usd()).toHaveTextContent('No disponible'))
    expect(usd()).not.toHaveTextContent('US$')
    expect(balance()).toBe('$ 1.000,00') // los pesos siguen funcionando
  })

  it('usa la última cotización válida guardada si la fuente deja de responder', async () => {
    const storage = new MemoryStorage()
    let up = true
    const source = {
      getUsdBlue: async () => {
        if (up) return SAMPLE_RATE
        throw new RateUnavailableError()
      },
    }
    const user = setupUser()
    const services = await firstRun(user, createTestServices({ rates: new CachingRateProvider(source, storage) }))
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '14055', concept: 'Sueldo' })
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 10,00'))
    document.body.innerHTML = ''

    up = false
    mount({ ...services, rates: new CachingRateProvider(source, storage) })
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 10,00'))
  })

  it('al abrir usa al instante la cotización guardada y luego la actualiza', async () => {
    const storage = new MemoryStorage()
    await new CachingRateProvider({ getUsdBlue: async () => ({ ...SAMPLE_RATE, sell: 1000 }) }, storage).getUsdBlue()
    let resolve: (value: typeof SAMPLE_RATE) => void = () => undefined
    const slow = { getUsdBlue: () => new Promise<typeof SAMPLE_RATE>((r) => (resolve = r)) }
    const user = setupUser()
    await firstRun(user, createTestServices({ rates: new CachingRateProvider(slow, storage) }))
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '1405,5', concept: 'Sueldo' })
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 1,41')) // 1.405,5 / 1.000
    resolve(SAMPLE_RATE)
    await waitFor(() => expect(usd()).toHaveTextContent('US$ 1,00')) // 1.405,5 / 1.405,5
  })

  it('el botón de ocultar saldo oculta pesos y dólares', async () => {
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getAllByRole('button', { name: 'Ocultar saldo' })[0]!)
    expect(screen.getByTestId('balance')).toHaveTextContent('$ ••••••')
    expect(usd()).toHaveTextContent('US$ ••••••')
  })
})

describe('Inicio: últimos servicios', () => {
  const services = () => screen.getByTestId('latest-services')

  it('sin gastos de servicios muestra un estado vacío, sin datos de ejemplo', async () => {
    const user = setupUser()
    await firstRun(user)
    expect(screen.getByText('Sin gastos de servicios')).toBeInTheDocument()
    expect(screen.queryByTestId('latest-services')).not.toBeInTheDocument()
  })

  it('lista los gastos reales de servicios (por comercio o categoría) con nombre, fecha, importe y moneda', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Gasto', { category: 'Transporte y movilidad', amount: '2000', concept: 'Carga SUBE' })
    await addMovement(user, 'Gasto', { category: 'Salidas y ocio', amount: '9999', concept: 'Cena con amigos' })
    await addMovement(user, 'Gasto', { category: 'Suscripciones y tecnología', amount: '4500,5', concept: 'Netflix' })
    await addMovement(user, 'Gasto', { category: 'Cuidado personal y compras', amount: '3000', concept: 'Mercado Libre auriculares' })
    await addMovement(user, 'Gasto', { category: 'Suscripciones y tecnología', amount: '800', concept: 'Hosting personal' })
    await addMovement(user, 'Ingreso', { category: 'Trabajo en relación de dependencia', amount: '50', concept: 'Reembolso Spotify' })

    const rows = within(services()).getAllByRole('listitem')
    // Más reciente primero; la cena (ocio) y el ingreso quedan afuera.
    expect(rows.map((r) => r.querySelector('p.type-subheading')?.textContent)).toEqual(['Hosting personal', 'Mercado Libre', 'Netflix', 'SUBE'])
    const netflix = rows[2]!
    expect(netflix).toHaveTextContent('Netflix')
    expect(netflix).toHaveTextContent('Hoy')
    expect(netflix).toHaveTextContent('− $ 4.500,50')
    expect(netflix).toHaveTextContent('ARS')
    expect(within(services()).queryByText(/Cena/)).not.toBeInTheDocument()
    expect(within(services()).queryByText(/Spotify/)).not.toBeInTheDocument()
  })

  it('muestra la moneda real del gasto', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Gasto', { country: 'Estados Unidos', category: 'Suscripciones y tecnología', amount: '15', concept: 'Spotify' })
    const row = within(services()).getByRole('listitem')
    expect(row).toHaveTextContent('Spotify')
    expect(row).toHaveTextContent('− US$ 15,00')
    expect(row).toHaveTextContent('USD')
  })

  it('un gasto de servicio anulado no aparece', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await addMovement(user, 'Gasto', { category: 'Suscripciones y tecnología', amount: '100', concept: 'Netflix' })
    const [t] = await services.repositories.transactions.list()
    await services.repositories.transactions.update([{ ...t!, status: 'CANCELLED' }])
    document.body.innerHTML = ''
    mount(services)
    await screen.findByTestId('balance')
    expect(screen.getByText('Sin gastos de servicios')).toBeInTheDocument()
  })
})

describe('Navegación', () => {
  it('cambia entre Inicio, Movimientos, Préstamos y Ahorros', async () => {
    const user = setupUser()
    await firstRun(user)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Inicio',
      'Movimientos',
      'Registrar movimiento',
      'Préstamos',
      'Ahorros',
    ])

    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    expect(screen.getByRole('heading', { name: 'Movimientos' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Movimientos' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(nav).getByRole('button', { name: 'Préstamos' }))
    expect(await screen.findByRole('heading', { name: 'Préstamos', level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Préstamos' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Movimientos' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /^Nuevo préstamo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Calculadora financiera/ })).toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: 'Ahorros' }))
    expect(await screen.findByRole('heading', { name: 'Ahorros', level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Ahorros' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Préstamos' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /^Nuevo frasco/ })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Más' })).not.toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: 'Inicio' }))
    expect(screen.getByTestId('balance')).toBeInTheDocument()
  })

  it('la lista de Movimientos muestra todos, agrupados por día', async () => {
    const user = setupUser()
    await firstRun(user)
    for (const n of ['1', '2', '3', '4', '5']) {
      await addMovement(user, 'Gasto', { category: 'Salidas y ocio', amount: n, concept: `Gasto ${n}`, date: `2026-10-0${n}` })
    }
    await user.click(screen.getByRole('button', { name: 'Movimientos' }))
    expect(await screen.findAllByText(/^Gasto \d$/)).toHaveLength(5)
  })
})
