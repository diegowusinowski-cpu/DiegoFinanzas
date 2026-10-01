import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { convertArsToUsd, detectService, latestServices } from './services'
import { buildTransaction } from './transactions'
import type { Transaction, TransactionStatus, TransactionType } from './models'

const NOW = new Date(2026, 9, 6, 12, 0)
let n = 0
const tx = (
  description: string,
  categoryId = 'exp-personal',
  over: { type?: TransactionType; status?: TransactionStatus; date?: string; time?: string; loanId?: string | null } = {},
): Transaction => ({
  ...buildTransaction(
    {
      accountId: 'acc',
      type: over.type ?? 'EXPENSE',
      amount: 1000,
      description,
      categoryId,
      date: over.date ?? '2026-10-06',
      time: over.time ?? '10:00',
      loanId: over.loanId ?? null,
    },
    { id: `t${++n}`, now: NOW },
  ),
  status: over.status ?? 'COMPLETED',
})

describe('detectService', () => {
  it.each([
    ['SUBE', 'SUBE', 'transport'],
    ['Carga sube del mes', 'SUBE', 'transport'],
    ['Mercado Libre', 'Mercado Libre', 'bag'],
    ['compra MELI', 'Mercado Libre', 'bag'],
    ['MercadoLibre envío', 'Mercado Libre', 'bag'],
    ['Claro abono', 'Claro', 'subscription'],
    ['Uber a casa', 'Uber', 'transport'],
    ['Netflix', 'Netflix', 'subscription'],
    ['Spotify Premium', 'Spotify', 'subscription'],
  ])('reconoce "%s" como %s', (description, name, icon) => {
    expect(detectService(tx(description), DEFAULT_CATEGORIES)).toMatchObject({ name, icon })
  })

  it('no confunde palabras que solo contienen el nombre', () => {
    expect(detectService(tx('Subestimé el gasto'), DEFAULT_CATEGORIES)).toBeNull()
    expect(detectService(tx('Clarosa'), DEFAULT_CATEGORIES)).toBeNull()
  })

  it('la categoría Suscripciones y tecnología cuenta como servicio aunque no sea una marca conocida', () => {
    expect(detectService(tx('Hosting web', 'exp-subscriptions'), DEFAULT_CATEGORIES)).toMatchObject({ name: 'Hosting web', icon: null })
    expect(detectService(tx('Luz', 'cat-expense-services'), DEFAULT_CATEGORIES)).toMatchObject({ name: 'Luz' })
  })

  it('otros gastos, ingresos, anulados, programados y préstamos no son servicios', () => {
    expect(detectService(tx('Cena'), DEFAULT_CATEGORIES)).toBeNull()
    expect(detectService(tx('Netflix', 'exp-subscriptions', { type: 'INCOME' }), DEFAULT_CATEGORIES)).toBeNull()
    expect(detectService(tx('Netflix', 'exp-subscriptions', { status: 'CANCELLED' }), DEFAULT_CATEGORIES)).toBeNull()
    expect(detectService(tx('Netflix', 'exp-subscriptions', { status: 'SCHEDULED' }), DEFAULT_CATEGORIES)).toBeNull()
    expect(detectService(tx('Préstamo a Uber', 'exp-loans', { loanId: 'l1' }), DEFAULT_CATEGORIES)).toBeNull()
  })
})

describe('latestServices', () => {
  it('devuelve los últimos servicios reales, del más reciente al más antiguo, hasta el límite', () => {
    const list = [
      tx('Netflix', 'exp-subscriptions', { date: '2026-10-01' }),
      tx('Cena'),
      tx('SUBE', 'exp-transport', { date: '2026-10-05' }),
      tx('Spotify', 'exp-subscriptions', { date: '2026-10-03' }),
      tx('Uber', 'exp-transport', { date: '2026-10-06', time: '09:00' }),
    ]
    expect(latestServices(list, DEFAULT_CATEGORIES, 3).map((s) => s.name)).toEqual(['Uber', 'SUBE', 'Spotify'])
    expect(latestServices(list, DEFAULT_CATEGORIES, 10)).toHaveLength(4)
  })

  it('sin servicios no hay nada (no se inventa ninguno)', () => {
    expect(latestServices([tx('Cena')], DEFAULT_CATEGORIES, 4)).toEqual([])
    expect(latestServices([], DEFAULT_CATEGORIES, 4)).toEqual([])
  })
})

describe('convertArsToUsd', () => {
  it('divide los pesos por la cotización y redondea al centavo', () => {
    expect(convertArsToUsd(140_550, 1405.5)).toBe(100) // $1.405,50 → US$ 1,00
    expect(convertArsToUsd(1_000_000, 1500)).toBe(667)
    expect(convertArsToUsd(-140_550, 1405.5)).toBe(-100)
  })
  it('sin cotización válida no convierte', () => {
    expect(convertArsToUsd(1000, 0)).toBeNull()
    expect(convertArsToUsd(1000, -5)).toBeNull()
    expect(convertArsToUsd(1000, Number.NaN)).toBeNull()
  })
})
