import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMovement, firstRun, goToAmount, setupUser, typeAmount } from '@/test/flowHelpers'

afterEach(() => {
  vi.useRealTimers()
})

const INCOME = { category: 'Trabajo en relación de dependencia' }
const EXPENSE = { category: 'Transporte y movilidad' }

describe('Efectivo en Ingreso y Gasto', () => {
  it('la pantalla del monto ofrece Transferencia y Efectivo (por defecto, transferencia)', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', INCOME)
    const group = screen.getByRole('radiogroup', { name: '¿Cómo lo recibiste?' })
    expect(within(group).getByRole('radio', { name: 'Transferencia' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'false')
  })

  it('en un gasto la pregunta es cómo lo pagaste', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Gasto', EXPENSE)
    expect(screen.getByRole('radiogroup', { name: '¿Cómo lo pagaste?' })).toBeInTheDocument()
  })

  it('lo elegido en el monto llega a la confirmación y se guarda como efectivo', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await goToAmount(user, 'Ingreso', INCOME)
    await typeAmount(user, '1000')
    await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Confirmar ingreso' }))
    await screen.findByTestId('movement-done')
    const [saved] = await services.repositories.transactions.list()
    expect(saved).toMatchObject({ type: 'INCOME', paymentMethod: 'CASH' })
  })

  it('se puede cambiar en la confirmación y también en un gasto', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await goToAmount(user, 'Gasto', EXPENSE)
    await typeAmount(user, '200')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('radio', { name: 'Efectivo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar gasto' }))
    await screen.findByTestId('movement-done')
    const [saved] = await services.repositories.transactions.list()
    expect(saved).toMatchObject({ type: 'EXPENSE', paymentMethod: 'CASH' })
  })
})

describe('Saldo de cuenta: efectivo y transferencia', () => {
  it('al tocar el saldo se ve el reparto y el total coincide con la tarjeta', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Ingreso', { ...INCOME, amount: '10000', method: 'Transferencia' })
    await addMovement(user, 'Ingreso', { ...INCOME, amount: '2500', method: 'Efectivo' })
    await addMovement(user, 'Gasto', { ...EXPENSE, amount: '500', method: 'Efectivo' })
    const card = screen.getByTestId('balance').textContent

    await user.click(screen.getByTestId('balance'))
    const sheet = within(await screen.findByRole('dialog', { name: 'Saldo de cuenta' }))
    expect(sheet.getByTestId('balance-cash')).toHaveTextContent('$ 2.000,00')
    expect(sheet.getByTestId('balance-transfer')).toHaveTextContent('$ 10.000,00')
    expect(sheet.getByTestId('balance-total')).toHaveTextContent('$ 12.000,00')
    expect(sheet.getByTestId('balance-total').textContent).toBe(card)
    expect(sheet.queryByTestId('balance-other')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Saldo de cuenta' })).not.toBeInTheDocument())
  })

  it('también se abre desde la leyenda de la tarjeta y respeta el saldo oculto', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Ingreso', { ...INCOME, amount: '1000', method: 'Efectivo' })
    await user.click(screen.getByRole('button', { name: 'Ocultar saldo' }))
    await user.click(screen.getByRole('button', { name: /Datos de cuenta/ }))
    const sheet = within(await screen.findByRole('dialog', { name: 'Saldo de cuenta' }))
    expect(sheet.getByTestId('balance-cash')).toHaveTextContent('$ ••••••')
    expect(sheet.getByTestId('balance-total')).toHaveTextContent('$ ••••••')
  })

  it('con cero movimientos muestra todo en cero', async () => {
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getByTestId('balance'))
    const sheet = within(await screen.findByRole('dialog', { name: 'Saldo de cuenta' }))
    expect(sheet.getByTestId('balance-cash')).toHaveTextContent('$ 0,00')
    expect(sheet.getByTestId('balance-transfer')).toHaveTextContent('$ 0,00')
  })
})

describe('Ícono de billete en los movimientos', () => {
  it('solo los movimientos en efectivo lo llevan: Inicio, Movimientos y detalle', async () => {
    const user = setupUser()
    await firstRun(user)
    await addMovement(user, 'Ingreso', { ...INCOME, amount: '1000', concept: 'Sueldo', method: 'Transferencia' })
    await addMovement(user, 'Gasto', { ...EXPENSE, amount: '300', concept: 'Colectivo', method: 'Efectivo' })

    const latest = within(screen.getByTestId('latest-movements'))
    const rows = latest.getAllByRole('listitem')
    const cashRow = rows.find((row) => within(row).queryByText('Colectivo'))!
    const transferRow = rows.find((row) => within(row).queryByText('Sueldo'))!
    expect(within(cashRow).getByRole('img', { name: 'Efectivo' })).toBeInTheDocument()
    expect(within(transferRow).queryByRole('img', { name: 'Efectivo' })).not.toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    await user.click(within(nav).getByRole('button', { name: 'Movimientos' }))
    const cashButton = await screen.findByRole('button', { name: /Colectivo, Gasto de/ })
    expect(within(cashButton).getByRole('img', { name: 'Efectivo' })).toBeInTheDocument()
    expect(within(await screen.findByRole('button', { name: /Sueldo, Ingreso de/ })).queryByRole('img', { name: 'Efectivo' })).not.toBeInTheDocument()

    await user.click(cashButton)
    const detail = within(await screen.findByRole('dialog'))
    expect(detail.getByText('Efectivo')).toBeInTheDocument()
  })
})
