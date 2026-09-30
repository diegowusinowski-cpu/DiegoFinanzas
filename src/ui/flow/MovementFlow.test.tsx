import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { goToAmount, mount, setupUser, typeAmount, firstRun, balance } from '@/test/flowHelpers'
import { createTestServices } from '@/test/services'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const amountText = () => screen.getByTestId('amount-display').textContent

async function confirmAndWait(user: ReturnType<typeof setupUser>, cta: string) {
  await user.click(screen.getByRole('button', { name: cta }))
  await screen.findByTestId('movement-done')
}

async function backToHome() {
  await act(async () => {
    vi.advanceTimersByTime(2000)
  })
  await waitFor(() => expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument())
}

describe('Flujo de INGRESO completo', () => {
  it('país → Individual → tipo → monto → confirmar → movimiento confirmado → Home', async () => {
    const user = setupUser()
    const services = await firstRun(user)

    await user.click(screen.getByRole('button', { name: 'Ingreso' }))

    // País: solo Argentina y Estados Unidos.
    expect(await screen.findByRole('heading', { name: 'Elegí el país' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Argentina|Estados Unidos/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /^Argentina/ }))

    // Titular: solo Individual (sin Empresa).
    expect(await screen.findByRole('heading', { name: 'Tipo de cuenta' })).toBeInTheDocument()
    expect(screen.queryByText(/Empresa/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Individual/ }))

    // Tipo de ingreso: las 5 categorías.
    expect(await screen.findByRole('heading', { name: 'Tipo de ingreso' })).toBeInTheDocument()
    const categories = [
      'Trabajo en relación de dependencia',
      'Préstamos',
      'Ventas ocasionales o emprendimiento',
      'Becas de estudio o ayuda estudiantil',
      'Rendimientos de ahorros o billeteras virtuales',
    ]
    for (const name of categories) expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Trabajo en relación de dependencia/ }))

    // Monto.
    expect(amountText()).toBe('0 ARS')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await typeAmount(user, '10000')
    expect(amountText()).toBe('10.000 ARS')
    expect(screen.getByText('Vos recibís 10.000 ARS')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Concepto'), 'Sueldo de octubre')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Confirmación: Ingresado / Tipo / Fecha.
    expect(await screen.findByText('Ingresado')).toBeInTheDocument()
    expect(screen.getByText('Trabajo en relación de dependencia', { selector: 'dd' })).toBeInTheDocument()
    expect(amountText()).toBe('10.000 ARS')
    expect(screen.getByRole('radio', { name: 'Transferencia' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
    expect(screen.getByRole('radio', { name: 'Efectivo' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-02' } })
    expect(screen.getByText('2 de Octubre del 2026')).toBeInTheDocument()

    await confirmAndWait(user, 'Confirmar ingreso')

    // Movimiento confirmado.
    const done = screen.getByTestId('movement-done')
    expect(within(done).getByText('Movimiento confirmado')).toBeInTheDocument()
    expect(within(done).getByTestId('amount-display')).toHaveTextContent('10.000 ARS')
    expect(within(done).getByText('Hecho')).toBeInTheDocument()
    expect(within(done).getByTestId('done-check')).toBeInTheDocument()
    expect(done).toHaveClass('animate-cover')

    // Guardado completo.
    const [saved] = await services.repositories.transactions.list()
    expect(saved).toMatchObject({
      type: 'INCOME',
      country: 'AR',
      currency: 'ARS',
      holder: 'INDIVIDUAL',
      categoryId: 'inc-employment',
      amount: 1_000_000,
      paymentMethod: 'CASH',
      date: '2026-10-02',
      description: 'Sueldo de octubre',
      status: 'COMPLETED',
    })
    expect(saved?.createdAt).toBeTruthy()
    expect(saved?.time).toMatch(/^\d{2}:\d{2}$/)

    // Vuelve solo al Home con el saldo actualizado.
    await backToHome()
    expect(balance()).toBe('$ 10.000,00')
    expect(within(screen.getByTestId('latest-movements')).getByText('Sueldo de octubre')).toBeInTheDocument()
  })
})

describe('Flujo de GASTO completo', () => {
  it('país → Individual → tipo → monto → confirmar → movimiento confirmado → Home', async () => {
    const user = setupUser()
    const services = await firstRun(user)

    await goToAmount(user, 'Gasto', { category: 'Transporte y movilidad' })
    await typeAmount(user, '2500,5')
    expect(amountText()).toBe('2.500,5 ARS')
    expect(screen.getByText('Vos pagás 2.500,5 ARS')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Gasto', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('Transporte y movilidad', { selector: 'dd' })).toBeInTheDocument()
    await confirmAndWait(user, 'Confirmar gasto')

    const [saved] = await services.repositories.transactions.list()
    expect(saved).toMatchObject({
      type: 'EXPENSE',
      country: 'AR',
      currency: 'ARS',
      holder: 'INDIVIDUAL',
      categoryId: 'exp-transport',
      amount: 250_050,
      paymentMethod: 'TRANSFER',
      description: 'Transporte y movilidad',
    })

    await backToHome()
    expect(balance()).toMatch(/2\.500,50/)
    expect(balance()).toMatch(/^-|−/)
  })

  it('las 5 categorías de gasto', async () => {
    const user = setupUser()
    await firstRun(user)
    await user.click(screen.getByRole('button', { name: 'Gasto' }))
    await user.click(await screen.findByRole('button', { name: /^Argentina/ }))
    await user.click(await screen.findByRole('button', { name: /^Individual/ }))
    expect(await screen.findByRole('heading', { name: 'Tipo de gasto' })).toBeInTheDocument()
    for (const name of [
      'Transporte y movilidad',
      'Salidas y ocio',
      'Préstamos',
      'Cuidado personal y compras',
      'Suscripciones y tecnología',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
  })

  it('Estados Unidos guarda USD y no se mezcla con el saldo en pesos', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await goToAmount(user, 'Gasto', { country: 'Estados Unidos', category: 'Salidas y ocio' })
    await typeAmount(user, '50')
    expect(amountText()).toBe('50 USD')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await confirmAndWait(user, 'Confirmar gasto')
    const [saved] = await services.repositories.transactions.list()
    expect(saved).toMatchObject({ country: 'US', currency: 'USD', amount: 5000 })
    await backToHome()
    expect(balance()).toBe('$ 0,00')
    expect(within(screen.getByTestId('latest-movements')).getByText('− US$ 50,00')).toBeInTheDocument()
  })
})

describe('Pantalla de monto', () => {
  it('teclado: coma una sola vez, 2 decimales, borrar, sin ceros a la izquierda', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })

    await typeAmount(user, '007')
    expect(amountText()).toBe('7 ARS')
    await typeAmount(user, '1234567')
    expect(amountText()).toBe('71.234.567 ARS')
    await user.click(screen.getByRole('button', { name: 'Coma decimal' }))
    await user.click(screen.getByRole('button', { name: 'Coma decimal' }))
    await typeAmount(user, '999')
    expect(amountText()).toBe('71.234.567,99 ARS')
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Borrar último dígito' }))
    expect(amountText()).toBe('71.234.567 ARS')
  })

  it('coma inicial → 0,; borrar todo vuelve a 0 y deshabilita Continuar', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    await user.click(screen.getByRole('button', { name: 'Coma decimal' }))
    expect(amountText()).toBe('0, ARS')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await typeAmount(user, '5')
    expect(amountText()).toBe('0,5 ARS')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Borrar último dígito' }))
    expect(amountText()).toBe('0 ARS')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('el selector de moneda cambia ARS ↔ USD y muestra el saldo de esa moneda', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    expect(screen.getByRole('button', { name: /Cambiar moneda/ })).toHaveTextContent('ARS · $ 0,00')
    await user.click(screen.getByRole('button', { name: /Cambiar moneda/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Moneda' })
    await user.click(within(sheet).getByRole('button', { name: /^Estados Unidos/ }))
    expect(screen.getByRole('button', { name: /Cambiar moneda/ })).toHaveTextContent('USD · US$ 0,00')
    expect(amountText()).toBe('0 USD')
  })

  it('un monto largo achica la tipografía en lugar de desbordar', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    await typeAmount(user, '1')
    expect(screen.getByTestId('amount-display')).toHaveClass('type-amount')
    await typeAmount(user, '234567890')
    expect(screen.getByTestId('amount-display')).toHaveClass('type-amount-sm')
  })
})

describe('Navegación dentro del flujo', () => {
  it('volver conserva lo elegido y desde el primer paso cierra', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Gasto', { category: 'Salidas y ocio' })
    await typeAmount(user, '1200')
    await user.type(screen.getByLabelText('Concepto'), 'Cine')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('button', { name: 'Confirmar gasto' })

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(amountText()).toBe('1.200 ARS')
    expect(screen.getByLabelText('Concepto')).toHaveValue('Cine')

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByRole('heading', { name: 'Elegí el país' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('heading', { name: 'Elegí el país' })).not.toBeInTheDocument()
    expect(balance()).toBe('$ 0,00') // nada se guardó
  })
})

describe('Confirmación final', () => {
  it('la animación cubre la pantalla y el Home vuelve ~1 s después', async () => {
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    await typeAmount(user, '100')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await confirmAndWait(user, 'Confirmar ingreso')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('movement-done')).toBeInTheDocument() // 650 ms de animación + 1 s de espera
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    await waitFor(() => expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument())
    expect(balance()).toBe('$ 100,00')
  })

  it('con prefers-reduced-motion espera solo ~1 s', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))
    const user = setupUser()
    await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    await typeAmount(user, '100')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await confirmAndWait(user, 'Confirmar ingreso')
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })
    await waitFor(() => expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument())
  })

  it('si falla el guardado muestra el error y no confirma', async () => {
    const user = setupUser()
    const services = createTestServices()
    await firstRun(user, services)
    vi.spyOn(services.repositories.transactions, 'add').mockRejectedValue(new Error('disco lleno'))
    await goToAmount(user, 'Gasto', { category: 'Salidas y ocio' })
    await typeAmount(user, '100')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar gasto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo guardar/)
    expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument()
  })

  it('el movimiento persiste al reabrir la app y el saldo se deriva de los movimientos', async () => {
    const user = setupUser()
    const services = await firstRun(user)
    await goToAmount(user, 'Ingreso', { category: 'Préstamos' })
    await typeAmount(user, '750')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await confirmAndWait(user, 'Confirmar ingreso')
    await backToHome()

    document.body.innerHTML = ''
    mount(services)
    expect((await screen.findByTestId('balance')).textContent).toBe('$ 750,00')
    expect(await services.repositories.transactions.list()).toHaveLength(1)
  })
})
