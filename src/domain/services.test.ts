import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { convertUsdToArs, detectService, latestServices } from './services'
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

describe('convertUsdToArs', () => {
  it('multiplica los dólares por la cotización del día (US$ 1.000 a $ 1.500 = $ 1.500.000)', () => {
    expect(convertUsdToArs(100_000, 1500)).toBe(150_000_000)
  })
  it('si la cotización cambia, el equivalente cambia y los dólares no (US$ 1.000 a $ 1.550 = $ 1.550.000)', () => {
    const usd = 100_000
    expect(convertUsdToArs(usd, 1550)).toBe(155_000_000)
    expect(usd).toBe(100_000)
  })
  it('redondea al centavo y acepta cotizaciones con decimales', () => {
    expect(convertUsdToArs(1_050, 1405.5)).toBe(1_475_775) // US$ 10,50 → $ 14.757,75
    expect(convertUsdToArs(1_001, 1405.55)).toBe(1_406_956) // US$ 10,01 → $ 14.069,56 (redondeado al centavo)
  })
  it('con cero dólares da cero', () => {
    expect(convertUsdToArs(0, 1500)).toBe(0)
  })
  it('sin cotización válida no convierte', () => {
    expect(convertUsdToArs(1000, 0)).toBeNull()
    expect(convertUsdToArs(1000, -5)).toBeNull()
    expect(convertUsdToArs(1000, Number.NaN)).toBeNull()
  })
})
