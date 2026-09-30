import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import type { AppServices } from '@/services/container'
import { AuthProvider } from '@/state/AuthContext'
import { ServicesProvider } from '@/state/ServicesContext'
import { App } from '@/ui/App'
import { ToastProvider } from '@/ui/components/Toast'
import { createTestServices } from './services'

export function mount(services: AppServices) {
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

/** Reloj falso que sigue avanzando con el tiempo real (para las esperas del flujo). */
export function setupUser(): UserEvent {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
}

export async function pressPin(user: UserEvent, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
}

export async function firstRun(user: UserEvent, services = createTestServices()) {
  mount(services)
  await user.type(await screen.findByLabelText('Número de teléfono'), '11 2345 6789')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await pressPin(user, '1234')
  await pressPin(user, '1234')
  await screen.findByTestId('balance')
  return services
}

export interface MovementInput {
  country?: 'Argentina' | 'Estados Unidos'
  category: string
  /** Texto del teclado: dígitos y coma (`2500,5`). */
  amount: string
  concept?: string
  method?: 'Efectivo' | 'Transferencia'
  /** `YYYY-MM-DD` */
  date?: string
}

/** Pasos hasta la pantalla de monto (país → titular → categoría). */
export async function goToAmount(user: UserEvent, kind: 'Gasto' | 'Ingreso', input: Pick<MovementInput, 'country' | 'category'>) {
  await user.click(screen.getByRole('button', { name: kind }))
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${input.country ?? 'Argentina'}`) }))
  await user.click(await screen.findByRole('button', { name: /^Individual/ }))
  const main = await screen.findByRole('main')
  await user.click(within(main).getByRole('button', { name: new RegExp(`^${input.category}`) }))
}

export async function typeAmount(user: UserEvent, amount: string) {
  for (const ch of amount) {
    await user.click(screen.getByRole('button', { name: ch === ',' ? 'Coma decimal' : ch }))
  }
}

/** Camino completo hasta "Movimiento confirmado" y de vuelta al Home. */
export async function addMovement(user: UserEvent, kind: 'Gasto' | 'Ingreso', input: MovementInput) {
  await goToAmount(user, kind, input)
  await typeAmount(user, input.amount)
  if (input.concept) await user.type(screen.getByLabelText('Concepto'), input.concept)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  if (input.method) await user.click(await screen.findByRole('radio', { name: input.method }))
  if (input.date) fireEvent.change(await screen.findByLabelText('Fecha'), { target: { value: input.date } })
  await user.click(await screen.findByRole('button', { name: kind === 'Ingreso' ? 'Confirmar ingreso' : 'Confirmar gasto' }))
  await screen.findByTestId('movement-done')
  await act(async () => {
    vi.advanceTimersByTime(2000)
  })
  await waitFor(() => expect(screen.queryByTestId('movement-done')).not.toBeInTheDocument())
  await screen.findByTestId('balance')
}

export const balance = () => screen.getByTestId('balance').textContent
