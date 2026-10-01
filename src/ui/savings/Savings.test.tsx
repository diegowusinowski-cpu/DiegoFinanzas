import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTransaction } from '@/domain'
import { balance, firstRun, mount, setupUser, typeAmount } from '@/test/flowHelpers'
import { createTestServices } from '@/test/services'

afterEach(() => {
  vi.useRealTimers()
})

const NOW = new Date(2026, 9, 6, 12, 0)
const navButton = (name: string) => within(screen.getByRole('navigation')).getByRole('button', { name })

/** Servicios con $1.000.000 de saldo previo. */
async function setup({ withBalance = true } = {}) {
  const user = setupUser()
  const services = createTestServices()
  if (withBalance) {
    await services.repositories.transactions.add(
      buildTransaction(
        {
          accountId: 'acc-main',
          type: 'INCOME',
          amount: 100_000_000,
          description: 'Saldo previo',
          categoryId: 'inc-employment',
          date: '2026-10-01',
          time: '09:00',
        },
        { id: 'seed-income', now: NOW },
      ),
    )
  }
  await firstRun(user, services)
  return { user, services }
}

async function openSavings(user: UserEvent) {
  await user.click(navButton('Ahorros'))
  await screen.findByRole('heading', { name: 'Ahorros', level: 1 })
}

interface JarInput {
  name: string
  target: string
  frequency: 'Semanal' | 'Quincenal' | 'Mensual'
  amount: string
  date?: string
}
const EXAMPLE: JarInput = { name: 'Vacaciones', target: '1000000', frequency: 'Semanal', amount: '50000' }

/** Recorre el flujo hasta quedar en el detalle del frasco creado. */
async function createJar(user: UserEvent, input: JarInput = EXAMPLE) {
  await user.click(screen.getByRole('button', { name: /^Nuevo frasco/ }))
  await user.type(await screen.findByLabelText('Nombre'), input.name)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Objetivo final' })
  await typeAmount(user, input.target)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await user.click(await screen.findByRole('radio', { name: input.frequency }))
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText(/^Monto a aportar por/)
  await typeAmount(user, input.amount)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Resumen del frasco' })
  if (input.date) fireEvent.change(screen.getByLabelText('Fecha objetivo'), { target: { value: input.date } })
  await user.click(screen.getByRole('button', { name: 'Crear frasco' }))
  return screen.findByRole('dialog', { name: 'Detalle del frasco' })
}

async function addMoney(user: UserEvent, amount: string) {
  await user.click(screen.getByRole('button', { name: 'Agregar dinero' }))
  await screen.findByRole('heading', { name: 'Agregar dinero' })
  await typeAmount(user, amount)
  await user.click(screen.getByRole('button', { name: 'Agregar al frasco' }))
}

const text = (id: string) => screen.getByTestId(id).textContent
const closeDetail = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Cerrar detalle' }))

describe('Ahorros: sección principal', () => {
  it('es una pestaña de la barra inferior (no está en el "+") con resumen y estado vacío', async () => {
    const { user } = await setup()
    await openSavings(user)
    expect(navButton('Ahorros')).toHaveAttribute('aria-current', 'page')
    expect(navButton('Préstamos')).not.toHaveAttribute('aria-current')
    expect(text('savings-balance')).toBe('$ 1.000.000,00')
    expect(text('savings-assigned')).toBe('$ 0,00')
    expect(text('savings-available')).toBe('$ 1.000.000,00')
    expect(screen.getByText('Todavía no hay frascos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }))
    const chooser = await screen.findByRole('dialog', { name: 'Nuevo movimiento' })
    expect(within(chooser).queryByText(/frasco|ahorro/i)).not.toBeInTheDocument()
  })
})

describe('Crear un frasco', () => {
  it('nombre → objetivo → plan → monto a aportar → crear, y queda en el listado', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    const detail = within(await createJar(user))

    expect(detail.getByRole('heading', { name: 'Vacaciones' })).toBeInTheDocument()
    expect(detail.getByTestId('jar-target')).toHaveTextContent('$ 1.000.000,00')
    expect(detail.getByTestId('jar-saved')).toHaveTextContent('$ 0,00')
    expect(detail.getByTestId('jar-remaining')).toHaveTextContent('$ 1.000.000,00')
    expect(detail.getByTestId('jar-percent')).toHaveTextContent('0%')
    expect(detail.getByTestId('jar-plan')).toHaveTextContent('Semanal · $ 50.000,00')
    expect(detail.getByText('Todavía no agregaste dinero a este frasco.')).toBeInTheDocument()

    const [jar] = await services.repositories.savings.listJars()
    expect(jar).toMatchObject({
      name: 'Vacaciones',
      targetAmount: 100_000_000,
      targetDate: null,
      plan: { frequency: 'WEEKLY', amount: 5_000_000 },
    })

    await closeDetail(user)
    const row = await screen.findByRole('button', { name: 'Frasco Vacaciones. Ver detalle' })
    expect(within(row).getByText('0%')).toBeInTheDocument()
    expect(row).toHaveTextContent('$ 0,00 de $ 1.000.000,00')
  })

  it('el nombre es obligatorio', async () => {
    const { user } = await setup()
    await openSavings(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo frasco/ }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre/i)
    expect(screen.getByRole('heading', { name: '¿Cómo se llama tu frasco?' })).toBeInTheDocument()
  })

  it('el objetivo y el aporte exigen un monto, y el aporte no supera el objetivo', async () => {
    const { user } = await setup()
    await openSavings(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo frasco/ }))
    await user.type(await screen.findByLabelText('Nombre'), 'Auto')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { name: 'Objetivo final' })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await typeAmount(user, '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await screen.findByText(/^Monto a aportar por/)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await typeAmount(user, '2000')
    expect(await screen.findByRole('alert')).toHaveTextContent('El aporte no puede superar el objetivo.')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('volver conserva lo cargado', async () => {
    const { user } = await setup()
    await openSavings(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo frasco/ }))
    await user.type(await screen.findByLabelText('Nombre'), 'Auto')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await typeAmount(user, '2500')
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Auto')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByTestId('amount-display')).toHaveTextContent('2.500 ARS')
  })

  it('crear no toca el saldo ni crea movimientos', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    await createJar(user)
    expect(await services.repositories.transactions.list()).toHaveLength(1)
    expect(text('savings-balance')).toBe('$ 1.000.000,00')
  })

  it('permite crear múltiples frascos independientes (el más nuevo primero)', async () => {
    const { user } = await setup()
    await openSavings(user)
    await createJar(user)
    await closeDetail(user)
    await createJar(user, { name: 'Auto', target: '500000', frequency: 'Mensual', amount: '25000' })
    await closeDetail(user)
    const rows = (await screen.findAllByRole('button', { name: /^Frasco / })).map((b) => b.getAttribute('aria-label'))
    expect(rows).toEqual(['Frasco Auto. Ver detalle', 'Frasco Vacaciones. Ver detalle'])
  })
})

describe('Agregar dinero', () => {
  it('$200.000 de $1.000.000 → 20 %, falta $800.000, historial y aporte registrado', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    const detail = within(await createJar(user))
    await addMoney(user, '200000')

    await waitFor(() => expect(detail.getByTestId('jar-saved')).toHaveTextContent('$ 200.000,00'))
    expect(detail.getByTestId('jar-percent')).toHaveTextContent('20%')
    expect(detail.getByTestId('jar-remaining')).toHaveTextContent('$ 800.000,00')
    expect(detail.getByRole('progressbar', { name: 'Progreso del frasco' })).toHaveAttribute('aria-valuenow', '20')
    const history = within(detail.getByRole('region', { name: 'Historial de aportes' }))
    expect(history.getAllByRole('listitem')).toHaveLength(1)
    expect(history.getByText('+ $ 200.000,00')).toBeInTheDocument()

    const contributions = await services.repositories.savings.listContributions()
    expect(contributions).toHaveLength(1)
    expect(contributions[0]).toMatchObject({ amount: 20_000_000, date: '2026-10-06' })
  })

  it('el progreso se actualiza con cada aporte y no se pisan los anteriores', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    const detail = within(await createJar(user))
    await addMoney(user, '200000')
    await waitFor(() => expect(detail.getByTestId('jar-percent')).toHaveTextContent('20%'))
    await addMoney(user, '300000')
    await waitFor(() => expect(detail.getByTestId('jar-percent')).toHaveTextContent('50%'))
    expect(detail.getByTestId('jar-saved')).toHaveTextContent('$ 500.000,00')
    expect(detail.getByTestId('jar-remaining')).toHaveTextContent('$ 500.000,00')
    const history = within(detail.getByRole('region', { name: 'Historial de aportes' }))
    expect(history.getAllByRole('listitem')).toHaveLength(2)
    expect(history.getByText('+ $ 200.000,00')).toBeInTheDocument()
    expect(history.getByText('+ $ 300.000,00')).toBeInTheDocument()
    expect((await services.repositories.savings.listContributions()).map((c) => c.amount)).toEqual([20_000_000, 30_000_000])
  })

  it('nunca supera el 100 % visualmente cuando se llega al objetivo', async () => {
    const { user } = await setup()
    await openSavings(user)
    const dialog = await createJar(user, { name: 'Celular', target: '1000', frequency: 'Semanal', amount: '500' })
    const detail = within(dialog)
    // Luca acompaña con la alcancía y, al llegar a la meta, celebra con el trofeo.
    expect(dialog.querySelector('[data-luca]')).toHaveAttribute('data-luca', 'saving')
    await addMoney(user, '1000')
    await waitFor(() => expect(detail.getByTestId('jar-percent')).toHaveTextContent('100%'))
    expect(dialog.querySelector('[data-luca]')).toHaveAttribute('data-luca', 'goal')
    await addMoney(user, '500')
    await waitFor(() => expect(detail.getByTestId('jar-saved')).toHaveTextContent('$ 1.500,00'))
    expect(detail.getByTestId('jar-percent')).toHaveTextContent('100%')
    expect(detail.getByTestId('jar-remaining')).toHaveTextContent('$ 0,00')
    expect(detail.getByRole('progressbar', { name: 'Progreso del frasco' })).toHaveAttribute('aria-valuenow', '100')
    expect(detail.getByTestId('jar-next')).toHaveTextContent('Sin aportes pendientes')
  })

  it('no se puede aportar más que el dinero disponible', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    await createJar(user)
    await user.click(screen.getByRole('button', { name: 'Agregar dinero' }))
    await typeAmount(user, '1000001')
    expect(await screen.findByRole('alert')).toHaveTextContent('No tenés tanto dinero disponible')
    expect(screen.getByRole('button', { name: 'Agregar al frasco' })).toBeDisabled()
    expect(await services.repositories.savings.listContributions()).toHaveLength(0)
  })

  it('con saldo en cero no hay nada para asignar', async () => {
    const { user } = await setup({ withBalance: false })
    await openSavings(user)
    await createJar(user)
    await user.click(screen.getByRole('button', { name: 'Agregar dinero' }))
    await typeAmount(user, '1')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar al frasco' })).toBeDisabled()
  })
})

describe('Saldo, dinero asignado y disponible', () => {
  it('asignar a un frasco NO baja el saldo total: solo cambia lo disponible', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    await createJar(user)
    await addMoney(user, '300000')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar dinero' })).not.toBeInTheDocument())
    await closeDetail(user)

    expect(text('savings-balance')).toBe('$ 1.000.000,00')
    expect(text('savings-assigned')).toBe('$ 300.000,00')
    expect(text('savings-available')).toBe('$ 700.000,00')

    // Home: el saldo total no cambió, y no se creó ningún gasto.
    await user.click(navButton('Inicio'))
    await screen.findByTestId('balance')
    expect(balance()).toBe('$ 1.000.000,00')
    expect(await services.repositories.transactions.list()).toHaveLength(1)
    await user.click(navButton('Movimientos'))
    expect(await screen.findByText('Saldo previo')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Ver detalle$/ })).toHaveLength(1) // solo el ingreso previo
  })

  it('con varios frascos el asignado es la suma y lo disponible lo que queda', async () => {
    const { user } = await setup()
    await openSavings(user)
    await createJar(user)
    await addMoney(user, '200000')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar dinero' })).not.toBeInTheDocument())
    await closeDetail(user)
    await createJar(user, { name: 'Auto', target: '500000', frequency: 'Mensual', amount: '25000' })
    await addMoney(user, '100000')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar dinero' })).not.toBeInTheDocument())
    await closeDetail(user)
    expect(text('savings-assigned')).toBe('$ 300.000,00')
    expect(text('savings-available')).toBe('$ 700.000,00')
    expect(text('savings-balance')).toBe('$ 1.000.000,00')
    // Cada frasco conserva lo suyo.
    expect(screen.getByRole('button', { name: 'Frasco Vacaciones. Ver detalle' })).toHaveTextContent('$ 200.000,00 de')
    expect(screen.getByRole('button', { name: 'Frasco Auto. Ver detalle' })).toHaveTextContent('$ 100.000,00 de')
  })

  it('un gasto posterior baja el saldo total y lo disponible, no el dinero de los frascos', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    await createJar(user)
    await addMoney(user, '300000')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar dinero' })).not.toBeInTheDocument())
    await closeDetail(user)
    await services.repositories.transactions.add(
      buildTransaction(
        { accountId: 'acc-main', type: 'EXPENSE', amount: 10_000_000, description: 'Alquiler', categoryId: 'cat-expense-food', date: '2026-10-05', time: '10:00' },
        { id: 'gasto', now: NOW },
      ),
    )
    document.body.innerHTML = ''
    mount(services)
    await screen.findByTestId('balance')
    await user.click(navButton('Ahorros'))
    expect(text('savings-balance')).toBe('$ 900.000,00')
    expect(text('savings-assigned')).toBe('$ 300.000,00')
    expect(text('savings-available')).toBe('$ 600.000,00')
  })
})

describe('Plan de ahorro', () => {
  it.each([
    ['Semanal', '13 de Octubre de 2026', 'semana'],
    ['Quincenal', '20 de Octubre de 2026', 'quincena'],
    ['Mensual', '6 de Noviembre de 2026', 'mes'],
  ] as const)('%s: plan, próximo aporte y recomendado', async (frequency, nextDate, unit) => {
    const { user } = await setup()
    await openSavings(user)
    const detail = within(await createJar(user, { ...EXAMPLE, frequency }))
    expect(detail.getByTestId('jar-plan')).toHaveTextContent(`${frequency} · $ 50.000,00`)
    expect(detail.getByTestId('jar-next')).toHaveTextContent(nextDate)
    expect(detail.getByTestId('jar-next-amount')).toHaveTextContent('$ 50.000,00')
    expect(detail.getByText(`Recomendado por ${unit}`)).toBeInTheDocument()
    expect(detail.getByTestId('jar-recommended')).toHaveTextContent('$ 50.000,00')
  })

  it('con fecha objetivo recomienda el monto necesario por período', async () => {
    const { user } = await setup()
    await openSavings(user)
    // 70 días hasta el 15/12: 10 semanas → $100.000 por semana.
    const detail = within(await createJar(user, { ...EXAMPLE, date: '2026-12-15' }))
    expect(detail.getByTestId('jar-recommended')).toHaveTextContent('$ 100.000,00')
    expect(detail.getByText('15 de Diciembre de 2026')).toBeInTheDocument()
  })

  it('el progreso y lo que falta se actualizan al aportar', async () => {
    const { user } = await setup()
    await openSavings(user)
    const detail = within(await createJar(user, { ...EXAMPLE, date: '2026-12-15' }))
    await addMoney(user, '500000')
    // Faltan $500.000 en 10 semanas → $50.000 por semana.
    await waitFor(() => expect(detail.getByTestId('jar-recommended')).toHaveTextContent('$ 50.000,00'))
    expect(detail.getByTestId('jar-remaining')).toHaveTextContent('$ 500.000,00')
  })
})

describe('Persistencia', () => {
  it('frascos, aportes y totales sobreviven a un reinicio', async () => {
    const { user, services } = await setup()
    await openSavings(user)
    await createJar(user)
    await addMoney(user, '200000')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar dinero' })).not.toBeInTheDocument())
    document.body.innerHTML = ''

    mount(services)
    await screen.findByTestId('balance')
    await user.click(navButton('Ahorros'))
    expect(text('savings-assigned')).toBe('$ 200.000,00')
    expect(text('savings-available')).toBe('$ 800.000,00')
    await user.click(await screen.findByRole('button', { name: 'Frasco Vacaciones. Ver detalle' }))
    const detail = within(await screen.findByRole('dialog', { name: 'Detalle del frasco' }))
    expect(detail.getByTestId('jar-percent')).toHaveTextContent('20%')
    expect(detail.getByText('+ $ 200.000,00')).toBeInTheDocument()
  })
})
