import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTransaction, receiptRows } from '@/domain'
import { balance, firstRun, mount, setupUser, typeAmount } from '@/test/flowHelpers'
import { createTestServices, fakeReceipts, fakeSharing } from '@/test/services'

afterEach(() => {
  vi.useRealTimers()
})

const NOW = new Date(2026, 9, 6, 12, 0)

/** Servicios con $500.000 de saldo previo y dobles de comprobante/compartir observables. */
async function setup({ canShare = false, withBalance = true } = {}) {
  const user = setupUser()
  const receipts = fakeReceipts()
  const sharing = fakeSharing(canShare)
  const services = createTestServices({ receipts: receipts.service, sharing: sharing.service })
  if (withBalance) {
    await services.repositories.transactions.add(
      buildTransaction(
        {
          accountId: 'acc-main',
          type: 'INCOME',
          amount: 50_000_000,
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
  return { user, services, receipts, sharing }
}

async function openLoans(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Abrir préstamos' }))
  await screen.findByRole('heading', { name: 'Préstamos', level: 1 })
}

interface LoanInput {
  amount: string
  count: number
  loanDate: string
  dueDate: string
  name: string
}
const EXAMPLE: LoanInput = { amount: '100000', count: 10, loanDate: '2026-10-02', dueDate: '2027-04-02', name: 'Carlos Mendoza' }

/** Recorre el flujo completo hasta tener el comprobante en pantalla. */
async function createLoan(user: UserEvent, input: LoanInput = EXAMPLE) {
  await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
  await typeAmount(user, input.amount)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await user.click(await screen.findByRole('radio', { name: new RegExp(`^${input.count} cuotas?$`) }))
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.change(await screen.findByLabelText('Fecha del préstamo'), { target: { value: input.loanDate } })
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.change(await screen.findByLabelText('Fecha límite de pago'), { target: { value: input.dueDate } })
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await user.type(await screen.findByLabelText('Nombre'), input.name)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await user.click(await screen.findByRole('button', { name: 'Crear préstamo' }))
  await screen.findByRole('dialog', { name: 'Comprobante de préstamo' })
}

async function closeReceiptToHome(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Listo' }))
  await user.click(await screen.findByRole('button', { name: 'Cerrar préstamos' }))
  await screen.findByTestId('balance')
}

describe('Préstamos: entrada', () => {
  it('el "+" abre Préstamos con las dos acciones principales', async () => {
    const { user } = await setup()
    await openLoans(user)
    expect(screen.getByRole('button', { name: /^Calculadora financiera/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Nuevo préstamo/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis préstamos' })).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay préstamos')).toBeInTheDocument()
  })
})

describe('Calculadora financiera', () => {
  it('$100.000 → interés $70.000, total $170.000; 10 cuotas → $17.000 por cuota; no crea nada', async () => {
    const { user, services } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Calculadora financiera/ }))

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await typeAmount(user, '100000')
    expect(screen.getByTestId('amount-display')).toHaveTextContent('100.000 ARS')
    const calc = within(screen.getByLabelText('Cálculo del préstamo'))
    expect(calc.getByText('Monto').nextElementSibling).toHaveTextContent('$ 100.000,00')
    expect(calc.getByText('Interés (70%)').nextElementSibling).toHaveTextContent('$ 70.000,00')
    expect(calc.getByText('Total a devolver').nextElementSibling).toHaveTextContent('$ 170.000,00')

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: '10 cuotas' }))
    const result = screen.getByLabelText('Resultado')
    expect(result).toHaveTextContent('10 cuotas de $ 17.000,00')
    expect(result).toHaveTextContent('$ 170.000,00 ÷ 10 cuotas')

    // Es solo una herramienta: nada se guardó.
    expect(await services.repositories.loans.listLoans()).toHaveLength(0)
    expect(await services.repositories.transactions.list()).toHaveLength(1) // solo el saldo previo
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    await user.click(await screen.findByRole('button', { name: 'Cerrar préstamos' }))
    expect(balance()).toBe('$ 500.000,00')
  })

  it('cuotas fuera de los atajos: "Otra cantidad"', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Calculadora financiera/ }))
    await typeAmount(user, '100000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.type(await screen.findByLabelText('Otra cantidad'), '15')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent('15 cuotas de $ 11.333,34')
    // Elegir un atajo reemplaza la cantidad personalizada.
    await user.click(screen.getByRole('radio', { name: '4 cuotas' }))
    expect(screen.getByLabelText('Otra cantidad')).toHaveValue('')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent('4 cuotas de $ 42.500,00')
  })

  it('ofrece las cuotas 1 a 10 y 12', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Calculadora financiera/ }))
    await typeAmount(user, '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const group = await screen.findByRole('radiogroup', { name: 'Cantidad de cuotas' })
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12'],
    )
  })
})

describe('Nuevo préstamo', () => {
  it('muestra el cálculo en tiempo real mientras se escribe el monto', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
    await typeAmount(user, '100000')
    const calc = within(screen.getByLabelText('Cálculo del préstamo'))
    expect(calc.getByText('Monto prestado').nextElementSibling).toHaveTextContent('$ 100.000,00')
    expect(calc.getByText('Interés 70%').nextElementSibling).toHaveTextContent('$ 70.000,00')
    expect(calc.getByText('Total a devolver').nextElementSibling).toHaveTextContent('$ 170.000,00')
  })

  it('el nombre es obligatorio', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
    await typeAmount(user, '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: '3 cuotas' }))
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { name: '¿Quién solicita el préstamo?' })
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre/i)
    expect(screen.getByRole('heading', { name: '¿Quién solicita el préstamo?' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre'), '   ')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: '¿Quién solicita el préstamo?' })).toBeInTheDocument()
  })

  it('si la fecha del préstamo pasa a la fecha límite, esta se corre 30 días', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
    await typeAmount(user, '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: '2 cuotas' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.change(await screen.findByLabelText('Fecha del préstamo'), { target: { value: '2030-01-10' } })
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByLabelText('Fecha límite de pago')).toHaveValue('2030-02-09')
  })

  it('volver conserva lo cargado', async () => {
    const { user } = await setup()
    await openLoans(user)
    await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
    await typeAmount(user, '2500')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: '6 cuotas' }))
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByTestId('amount-display')).toHaveTextContent('2.500 ARS')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('radio', { name: '6 cuotas' })).toBeChecked()
  })

  it('crear el préstamo: resumen, guardado, cuotas, movimiento GASTO y saldo', async () => {
    const { user, services, receipts } = await setup()
    await openLoans(user)
    expect(await services.repositories.loans.listLoans()).toHaveLength(0)

    // Resumen previo a crear.
    await user.click(screen.getByRole('button', { name: /^Nuevo préstamo/ }))
    await typeAmount(user, '100000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: '10 cuotas' }))
    expect(screen.getByLabelText('Resultado')).toHaveTextContent('10 cuotas de $ 17.000,00')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: '¿Qué fecha se presta?' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fecha del préstamo'), { target: { value: '2026-10-02' } })
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: '¿Qué fecha debe pagar?' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fecha límite de pago'), { target: { value: '2027-04-02' } })
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.type(await screen.findByLabelText('Nombre'), 'Carlos Mendoza')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await screen.findByRole('heading', { name: 'Resumen del préstamo' })
    const row = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling
    expect(row('Prestatario')).toHaveTextContent('Carlos Mendoza')
    expect(row('Interés 70%')).toHaveTextContent('$ 70.000,00')
    expect(row('Total a devolver')).toHaveTextContent('$ 170.000,00')
    expect(row('Plan de pago')).toHaveTextContent('10 cuotas de $ 17.000,00')
    expect(row('Fecha del préstamo')).toHaveTextContent('2 de Octubre de 2026')
    expect(row('Fecha límite de pago')).toHaveTextContent('2 de Abril de 2027')
    expect(screen.getByTestId('amount-display')).toHaveTextContent('100.000 ARS')
    // Todavía no se guardó nada.
    expect(await services.repositories.loans.listLoans()).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Crear préstamo' }))
    await screen.findByRole('dialog', { name: 'Comprobante de préstamo' })

    // Préstamo y cuotas.
    const [loan] = await services.repositories.loans.listLoans()
    const installments = await services.repositories.loans.listInstallments()
    expect(loan).toMatchObject({
      borrowerName: 'Carlos Mendoza',
      principalAmount: 10_000_000,
      interestRate: 70,
      interestAmount: 7_000_000,
      totalAmount: 17_000_000,
      installmentCount: 10,
      installmentAmount: 1_700_000,
      loanDate: '2026-10-02',
      dueDate: '2027-04-02',
      status: 'ACTIVE',
    })
    expect(installments).toHaveLength(10)
    expect(installments.every((i) => i.loanId === loan?.id && i.status === 'PENDING' && i.amount === 1_700_000)).toBe(true)
    expect(installments.map((i) => i.installmentNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // UN movimiento GASTO por el monto prestado (nada por el interés).
    const transactions = await services.repositories.transactions.list()
    expect(transactions).toHaveLength(2) // saldo previo + gasto del préstamo
    const expense = transactions.find((t) => t.type === 'EXPENSE')
    expect(expense).toMatchObject({
      description: 'Préstamo a Carlos Mendoza',
      categoryId: 'exp-loans',
      amount: 10_000_000,
      date: '2026-10-02',
      currency: 'ARS',
      loanId: loan?.id,
    })
    expect(loan?.transactionId).toBe(expense?.id)

    // Saldo: $500.000 → $400.000 (descuenta solo lo prestado, NO los $170.000).
    await closeReceiptToHome(user)
    expect(balance()).toBe('$ 400.000,00')
    expect(balance()).not.toBe('$ 330.000,00')
    expect(receipts.rendered).toHaveLength(1)
  })

  it('el movimiento aparece en Movimientos como gasto de categoría Préstamos', async () => {
    const { user } = await setup()
    await openLoans(user)
    await createLoan(user)
    await closeReceiptToHome(user)
    await user.click(screen.getByRole('button', { name: 'Movimientos' }))
    const rowButton = await screen.findByRole('button', { name: /^Préstamo a Carlos Mendoza, Gasto/ })
    expect(within(rowButton).getByText('− $ 100.000,00')).toBeInTheDocument()
  })
})

describe('Comprobante', () => {
  it('se muestra como imagen y se genera a partir de los datos del préstamo', async () => {
    const { user, receipts } = await setup()
    await openLoans(user)
    await createLoan(user)
    const dialog = screen.getByRole('dialog', { name: 'Comprobante de préstamo' })
    expect(within(dialog).getByRole('heading', { name: 'Préstamo creado' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: 'Comprobante de préstamo' })).toBeInTheDocument()
    expect(receipts.rendered[0]).toMatchObject({ borrowerName: 'Carlos Mendoza', totalAmount: 17_000_000 })
  })

  it('las filas del comprobante', async () => {
    const { user, receipts } = await setup()
    await openLoans(user)
    await createLoan(user)
    const loan = receipts.rendered[0]!
    expect(receiptRows(loan)).toEqual([
      { label: 'Prestatario', value: 'Carlos Mendoza' },
      { label: 'Monto prestado', value: '$ 100.000,00' },
      { label: 'Interés', value: '70% · $ 70.000,00' },
      { label: 'Total a devolver', value: '$ 170.000,00' },
      { label: 'Plan de pago', value: '10 cuotas de $ 17.000,00' },
      { label: 'Fecha del préstamo', value: '2 de Octubre de 2026' },
      { label: 'Fecha límite de pago', value: '2 de Abril de 2027' },
    ])
  })

  it('sin Web Share: se ofrece guardar/descargar la imagen', async () => {
    const { user, sharing } = await setup({ canShare: false })
    await openLoans(user)
    await createLoan(user)
    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Guardar imagen' }))
    expect(sharing.downloads).toHaveLength(1)
    expect(sharing.downloads[0]?.filename).toBe('comprobante-prestamo-carlos-mendoza-2026-10-02.png')
    expect(sharing.downloads[0]?.blob.type).toBe('image/png')
  })

  it('con Web Share: se comparte el archivo con el menú nativo (y también se puede guardar)', async () => {
    const { user, sharing } = await setup({ canShare: true })
    await openLoans(user)
    await createLoan(user)
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    await waitFor(() => expect(sharing.shared).toHaveLength(1))
    expect(sharing.shared[0]?.file.name).toBe('comprobante-prestamo-carlos-mendoza-2026-10-02.png')
    expect(sharing.shared[0]?.file.type).toBe('image/png')
    expect(screen.getByRole('button', { name: 'Guardar imagen' })).toBeInTheDocument()
  })

  it('si la imagen no se puede generar, se informa y se puede reintentar', async () => {
    const user = setupUser()
    let fail = true
    const services = createTestServices({
      receipts: {
        render: () => (fail ? Promise.reject(new Error('sin canvas')) : Promise.resolve(new window.Blob(['png'], { type: 'image/png' }))),
      },
    })
    await firstRun(user, services)
    await openLoans(user)
    await createLoan(user)
    expect(await screen.findByText(/No se pudo generar la imagen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar imagen' })).toBeDisabled()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('img', { name: 'Comprobante de préstamo' })).toBeInTheDocument()
  })
})

describe('Mis préstamos', () => {
  it('lista persona, montos, cuotas, próxima cuota y estado', async () => {
    const { user } = await setup()
    await openLoans(user)
    await createLoan(user)
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    const card = await screen.findByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' })
    const c = within(card)
    expect(c.getByText('Carlos Mendoza')).toBeInTheDocument()
    expect(c.getByText('$ 100.000,00')).toBeInTheDocument()
    expect(c.getByText('prestados')).toBeInTheDocument()
    expect(c.getByText('$ 170.000,00')).toBeInTheDocument()
    expect(c.getByText('a devolver')).toBeInTheDocument()
    expect(c.getByText('10 cuotas')).toBeInTheDocument()
    expect(c.getByText('Próxima cuota: $ 17.000,00')).toBeInTheDocument()
    expect(c.getByText(/^Vence: \d+ de \w+/)).toBeInTheDocument()
    expect(c.getByText('Activo')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay préstamos')).not.toBeInTheDocument()
  })

  it('el detalle muestra datos, avance y cada cuota con su estado', async () => {
    const { user } = await setup()
    await openLoans(user)
    await createLoan(user)
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    await user.click(await screen.findByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' }))

    const detail = within(await screen.findByRole('dialog', { name: 'Detalle del préstamo' }))
    const value = (label: string) => detail.getByText(label, { selector: 'dt' }).nextElementSibling
    expect(value('Prestatario')).toHaveTextContent('Carlos Mendoza')
    expect(value('Monto original')).toHaveTextContent('$ 100.000,00')
    expect(value('Interés')).toHaveTextContent('70% · $ 70.000,00')
    expect(value('Total a devolver')).toHaveTextContent('$ 170.000,00')
    expect(value('Cuotas')).toHaveTextContent('10 cuotas de $ 17.000,00')
    expect(value('Cuotas pagadas')).toHaveTextContent('0')
    expect(value('Cuotas pendientes')).toHaveTextContent('10')
    expect(value('Fecha del préstamo')).toHaveTextContent('2 de Octubre de 2026')
    expect(value('Fecha límite de pago')).toHaveTextContent('2 de Abril de 2027')
    expect(detail.getByText('0 de 10 cuotas pagadas')).toBeInTheDocument()

    const items = detail.getAllByRole('listitem')
    expect(items).toHaveLength(10)
    expect(items[0]).toHaveTextContent('Cuota 1 de 10')
    expect(items[0]).toHaveTextContent('$ 17.000,00')
    expect(items[9]).toHaveTextContent('Cuota 10 de 10')
    expect(items[9]).toHaveTextContent('Vence: 2 de Abril de 2027')
    items.forEach((item) => expect(within(item).getByText('Pendiente')).toBeInTheDocument())
  })

  it('"Ver comprobante" abre el comprobante asociado y vuelve al detalle', async () => {
    const { user, receipts } = await setup()
    await openLoans(user)
    await createLoan(user)
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    await user.click(await screen.findByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' }))
    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))
    const dialog = await screen.findByRole('dialog', { name: 'Comprobante de préstamo' })
    expect(within(dialog).getByRole('heading', { name: 'Comprobante' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: 'Comprobante de préstamo' })).toBeInTheDocument()
    expect(receipts.rendered.at(-1)?.borrowerName).toBe('Carlos Mendoza')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByRole('dialog', { name: 'Detalle del préstamo' })).toBeInTheDocument()
  })

  it('persiste al recargar: préstamo, cuotas, movimiento y saldo', async () => {
    const { user, services } = await setup()
    await openLoans(user)
    await createLoan(user)
    await closeReceiptToHome(user)
    document.body.innerHTML = ''

    mount(services)
    await screen.findByTestId('balance')
    expect(balance()).toBe('$ 400.000,00')
    await user.click(screen.getByRole('button', { name: 'Abrir préstamos' }))
    const card = await screen.findByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' })
    await user.click(card)
    const detail = within(await screen.findByRole('dialog', { name: 'Detalle del préstamo' }))
    expect(detail.getAllByRole('listitem')).toHaveLength(10)
  })

  it('varios préstamos: el más reciente primero', async () => {
    const { user } = await setup()
    await openLoans(user)
    await createLoan(user)
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    await createLoan(user, { ...EXAMPLE, name: 'Ana Pérez', amount: '20000', count: 2 })
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    const cards = (await screen.findAllByRole('button', { name: /^Préstamo de / })).map((b) => b.getAttribute('aria-label'))
    expect(cards).toEqual(['Préstamo de Ana Pérez. Ver detalle', 'Préstamo de Carlos Mendoza. Ver detalle'])
    await act(async () => undefined)
  })
})
