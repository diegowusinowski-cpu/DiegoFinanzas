import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTransaction, type NewTransactionInput, type Transaction } from '@/domain'
import { firstRun, setupUser } from '@/test/flowHelpers'
import { createTestServices } from '@/test/services'
import { categoryIcon } from './categoryIcon'

afterEach(() => {
  vi.useRealTimers()
})

// El reloj de prueba arranca el martes 6 de octubre de 2026 a las 12:00.
const NOW = new Date(2026, 9, 6, 12, 0)
let seq = 0
const make = (over: Partial<NewTransactionInput> & { description: string }): Transaction =>
  buildTransaction(
    {
      accountId: 'acc-main',
      type: 'EXPENSE',
      amount: 100_000,
      categoryId: 'exp-leisure',
      date: '2026-10-06',
      time: '10:00',
      paymentMethod: 'TRANSFER',
      ...over,
    },
    { id: `seed-${++seq}`, now: new Date(NOW.getTime() - 60_000 + seq) },
  )

const SEED: Transaction[] = [
  make({ description: 'Netflix', categoryId: 'exp-subscriptions', amount: 1_250_050, date: '2026-10-06' }),
  make({ description: 'Sueldo', type: 'INCOME', categoryId: 'inc-employment', amount: 50_000_000, date: '2026-10-05', paymentMethod: 'TRANSFER' }),
  make({ description: 'Colectivo', categoryId: 'exp-transport', amount: 120_000, date: '2026-10-02', paymentMethod: 'CASH' }),
  make({ description: 'Spotify', categoryId: 'exp-subscriptions', amount: 450_000, date: '2026-09-20' }),
  make({ description: 'Venta de bici', type: 'INCOME', categoryId: 'inc-sales', amount: 5_000, date: '2026-09-15', country: 'US', currency: 'USD', paymentMethod: 'CASH' }),
  make({ description: 'Netflix reembolso', type: 'INCOME', categoryId: 'inc-loans', amount: 300_000, date: '2026-09-01' }),
  make({ description: 'Regalo', categoryId: 'exp-personal', amount: 800_000, date: '2025-12-24' }),
  make({ description: 'Alquiler', categoryId: 'exp-loans', amount: 9_000_000, date: '2026-10-20' }),
]

async function openMovements(seed: Transaction[] = SEED) {
  const user = setupUser()
  const services = createTestServices()
  for (const t of seed) await services.repositories.transactions.add(t)
  // Movimiento de una versión anterior: sin tipo de operación.
  await firstRun(user, services)
  await user.click(screen.getByRole('button', { name: 'Movimientos' }))
  await screen.findByRole('heading', { name: 'Movimientos', level: 1 })
  return { user, services }
}

const rows = () => screen.queryAllByRole('button', { name: /Ver detalle$/ })
const rowTitles = () => rows().map((r) => r.getAttribute('aria-label')?.split(',')[0])

describe('Movimientos: listado real', () => {
  it('Home → Movimientos muestra los movimientos persistidos, agrupados por período', async () => {
    await openMovements()
    const groups = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(groups).toEqual(['Próximos', 'Hoy', 'Ayer', 'Este mes', 'Septiembre', 'Diciembre 2025'])
    expect(rowTitles()).toEqual([
      'Alquiler',
      'Netflix',
      'Sueldo',
      'Colectivo',
      'Spotify',
      'Venta de bici',
      'Netflix reembolso',
      'Regalo',
    ])
  })

  it('cada fila muestra importe con signo, moneda, fecha y estado', async () => {
    await openMovements()
    const netflix = screen.getByRole('button', { name: /^Netflix, Gasto/ })
    expect(within(netflix).getByText('− $ 12.500,50')).toBeInTheDocument()
    expect(within(netflix).getByText('ARS')).toBeInTheDocument()
    expect(within(netflix).getByText(/Hoy, 10:00/)).toBeInTheDocument()

    const sueldo = screen.getByRole('button', { name: /^Sueldo, Ingreso/ })
    expect(within(sueldo).getByText('+ $ 500.000,00')).toBeInTheDocument()
    expect(within(sueldo).getByText(/Ayer, 10:00/)).toBeInTheDocument()

    const usd = screen.getByRole('button', { name: /^Venta de bici/ })
    expect(within(usd).getByText('+ US$ 50,00')).toBeInTheDocument()
    expect(within(usd).getByText('USD')).toBeInTheDocument()

    const future = screen.getByRole('button', { name: /^Alquiler/ })
    expect(within(future).getByText('Programado')).toBeInTheDocument()
  })

  it('sin movimientos: estado vacío, sin datos ficticios', async () => {
    await openMovements([])
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(rows()).toHaveLength(0)
  })

  it('no duplica ni inventa movimientos: la lista coincide con lo persistido', async () => {
    const { services } = await openMovements()
    expect(rows()).toHaveLength((await services.repositories.transactions.list()).length)
  })
})

describe('Movimientos: búsqueda', () => {
  it('filtra en tiempo real mientras se escribe', async () => {
    const { user } = await openMovements()
    const search = screen.getByRole('searchbox', { name: 'Buscar movimientos' })
    expect(search).toHaveAttribute('placeholder', 'Buscar')
    await user.type(search, 'net')
    expect(rowTitles()).toEqual(['Netflix', 'Netflix reembolso'])
    await user.type(search, 'flix reem')
    expect(rowTitles()).toEqual(['Netflix reembolso'])
  })

  it.each([
    ['concepto', 'spotify', ['Spotify']],
    ['categoría (sin tildes)', 'suscripciones', ['Netflix', 'Spotify']],
    ['categoría con tilde', 'préstamos', ['Alquiler', 'Netflix reembolso']],
    ['tipo', 'ingresos', ['Sueldo', 'Venta de bici', 'Netflix reembolso']],
    ['importe', '12.500', ['Netflix']],
    ['importe exacto', '500000', ['Sueldo']],
    ['fecha (día y mes)', '2 de octubre', ['Colectivo']],
    ['fecha (mes)', 'septiembre', ['Spotify', 'Venta de bici', 'Netflix reembolso']],
    ['fecha (dd/mm/aaaa)', '24/12/2025', ['Regalo']],
    ['hoy', 'hoy', ['Netflix']],
  ])('por %s', async (_name, query, expected) => {
    const { user } = await openMovements()
    await user.type(screen.getByRole('searchbox'), query)
    expect(rowTitles()).toEqual(expected)
  })

  it('sin resultados y botón para borrar la búsqueda', async () => {
    const { user } = await openMovements()
    await user.type(screen.getByRole('searchbox'), 'zzzz')
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(rows()).toHaveLength(8)
  })
})

describe('Movimientos: filtro Todos / Gastos / Ingresos', () => {
  async function applyFilter(user: ReturnType<typeof setupUser>, name: 'Todos' | 'Gastos' | 'Ingresos') {
    await user.click(screen.getByRole('button', { name: /^Filtrar movimientos/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrar' })
    await user.click(within(sheet).getByRole('radio', { name }))
    expect(screen.queryByRole('dialog', { name: 'Filtrar' })).not.toBeInTheDocument()
  }

  it('el panel ofrece Todos, Gastos e Ingresos y marca el actual', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: /^Filtrar movimientos/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrar' })
    expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Todos', 'Gastos', 'Ingresos'])
    expect(within(sheet).getByRole('radio', { name: 'Todos' })).toBeChecked()
  })

  it('Gastos muestra solo gastos; Ingresos solo ingresos; Todos vuelve a mostrar todo', async () => {
    const { user } = await openMovements()
    await applyFilter(user, 'Gastos')
    expect(rowTitles()).toEqual(['Alquiler', 'Netflix', 'Colectivo', 'Spotify', 'Regalo'])
    expect(screen.getByTestId('filter-active')).toBeInTheDocument()

    await applyFilter(user, 'Ingresos')
    expect(rowTitles()).toEqual(['Sueldo', 'Venta de bici', 'Netflix reembolso'])

    await applyFilter(user, 'Todos')
    expect(rows()).toHaveLength(8)
    expect(screen.queryByTestId('filter-active')).not.toBeInTheDocument()
  })

  it('se puede cerrar el panel con la X o con Esc sin cambiar el filtro', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: /^Filtrar movimientos/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Filtrar' })).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Filtrar movimientos/ }))
    await screen.findByRole('dialog', { name: 'Filtrar' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rows()).toHaveLength(8)
  })

  it('filtro + búsqueda funcionan juntos', async () => {
    const { user } = await openMovements()
    await user.type(screen.getByRole('searchbox'), 'Netflix')
    expect(rowTitles()).toEqual(['Netflix', 'Netflix reembolso'])

    await applyFilter(user, 'Gastos')
    expect(rowTitles()).toEqual(['Netflix'])

    await applyFilter(user, 'Ingresos')
    expect(rowTitles()).toEqual(['Netflix reembolso'])

    await applyFilter(user, 'Todos')
    expect(rowTitles()).toEqual(['Netflix', 'Netflix reembolso'])
  })
})

describe('Movimientos: detalle', () => {
  it('muestra los datos reales guardados', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: /^Netflix, Gasto/ }))
    const detail = await screen.findByRole('dialog', { name: 'Detalle del movimiento' })
    const d = within(detail)
    expect(d.getByTestId('detail-amount')).toHaveTextContent('− $ 12.500,50')
    const value = (label: string) => d.getByText(label, { selector: 'dt' }).nextElementSibling
    expect(value('Tipo')).toHaveTextContent('Gasto')
    expect(value('Importe')).toHaveTextContent('$ 12.500,50')
    expect(value('Moneda')).toHaveTextContent('ARS')
    expect(value('Categoría')).toHaveTextContent('Suscripciones y tecnología')
    expect(value('Tipo de operación')).toHaveTextContent('Transferencia')
    expect(value('País')).toHaveTextContent('Argentina')
    expect(value('Fecha')).toHaveTextContent('6 de Octubre del 2026, 10:00')
    expect(value('Estado')).toHaveTextContent('Completado')
    expect(d.getByText('Netflix', { selector: 'p' })).toBeInTheDocument() // concepto
  })

  it('ingreso en USD y en efectivo', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: /^Venta de bici/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Detalle del movimiento' }))
    expect(d.getByTestId('detail-amount')).toHaveTextContent('+ US$ 50,00')
    expect(d.getByText('Moneda', { selector: 'dt' }).nextElementSibling).toHaveTextContent('USD')
    expect(d.getByText('País', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Estados Unidos')
    expect(d.getByText('Tipo de operación', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Efectivo')
  })

  it('movimiento programado y movimiento sin tipo de operación', async () => {
    const legacy = make({ description: 'Viejo', date: '2026-10-01' })
    const { user } = await openMovements([make({ description: 'Alquiler', date: '2026-10-20' }), { ...legacy, paymentMethod: null }])
    await user.click(screen.getByRole('button', { name: /^Alquiler/ }))
    let d = within(await screen.findByRole('dialog', { name: 'Detalle del movimiento' }))
    expect(d.getByText('Estado', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Programado')
    await user.click(d.getByRole('button', { name: 'Cerrar detalle' }))

    await user.click(screen.getByRole('button', { name: /^Viejo/ }))
    d = within(await screen.findByRole('dialog', { name: 'Detalle del movimiento' }))
    expect(d.getByText('Tipo de operación', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—')
  })

  it('volver cierra el detalle y conserva búsqueda y filtro', async () => {
    const { user } = await openMovements()
    await user.type(screen.getByRole('searchbox'), 'netflix')
    await user.click(screen.getByRole('button', { name: /^Netflix reembolso/ }))
    await screen.findByRole('dialog', { name: 'Detalle del movimiento' })
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('netflix')
    expect(rowTitles()).toEqual(['Netflix', 'Netflix reembolso'])
  })

  it('el detalle es de solo lectura: sin editar ni eliminar', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: /^Netflix, Gasto/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Detalle del movimiento' }))
    expect(d.queryByRole('button', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument()
  })
})

describe('Movimientos: navegación', () => {
  it('el botón volver lleva al Home y la navegación inferior sigue funcionando', async () => {
    const { user } = await openMovements()
    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(await screen.findByTestId('balance')).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    expect(await screen.findByRole('heading', { name: 'Movimientos', level: 1 })).toBeInTheDocument()
    await user.click(within(nav).getByRole('button', { name: 'Inicio' }))
    expect(screen.getByTestId('balance')).toBeInTheDocument()
  })

  it('un movimiento registrado con el flujo aparece en Movimientos', async () => {
    const { user } = await openMovements([])
    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    await screen.findByTestId('balance')
    const { addMovement } = await import('@/test/flowHelpers')
    await addMovement(user, 'Gasto', { category: 'Transporte y movilidad', amount: '2500', concept: 'Subte' })
    await user.click(screen.getByRole('button', { name: 'Movimientos' }))
    const row = await screen.findByRole('button', { name: /^Subte, Gasto/ })
    expect(within(row).getByText('− $ 2.500,00')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Hoy' })).toBeInTheDocument()
    fireEvent.scroll(window)
  })
})

describe('iconos por categoría', () => {
  it.each([
    ['exp-transport', 'EXPENSE', 'transport'],
    ['exp-leisure', 'EXPENSE', 'leisure'],
    ['exp-loans', 'EXPENSE', 'loan'],
    ['inc-loans', 'INCOME', 'loan'],
    ['exp-subscriptions', 'EXPENSE', 'subscription'],
    ['inc-employment', 'INCOME', 'work'],
    ['inc-sales', 'INCOME', 'store'],
    ['exp-personal', 'EXPENSE', 'bag'],
    ['inc-scholarship', 'INCOME', 'scholarship'],
    ['inc-yield', 'INCOME', 'trend'],
    ['desconocida', 'INCOME', 'arrow-down'],
    ['desconocida', 'EXPENSE', 'arrow-up'],
  ] as const)('%s → %s', (id, type, icon) => {
    expect(categoryIcon(id, type)).toBe(icon)
  })
})
