import { describe, expect, it } from 'vitest'
import { computeBalance } from './balance'
import {
  addMonths,
  addPeriod,
  buildContribution,
  buildJar,
  jarSummary,
  progressPercent,
  progressRatio,
  savedIn,
  savingsTotals,
  validateContribution,
  validateNewJar,
  type NewJarInput,
} from './savings'
import type { SavingsContribution, SavingsJar } from './models'
import { buildTransaction } from './transactions'

const NOW = new Date(2026, 9, 6, 12, 0)
const ids = () => {
  let n = 0
  return () => `id-${++n}`
}
const input = (over: Partial<NewJarInput> = {}): NewJarInput => ({
  name: 'Vacaciones',
  targetAmount: 100_000_000, // $ 1.000.000
  targetDate: null,
  plan: { frequency: 'MONTHLY', amount: 5_000_000 },
  ...over,
})
const jar = (over: Partial<NewJarInput> = {}) => buildJar(input(over), { now: NOW, newId: ids() })
const contribution = (j: SavingsJar, amount: number, date = '2026-10-06', n = 1): SavingsContribution => ({
  id: `c-${n}`,
  jarId: j.id,
  amount,
  date,
  createdAt: `${date}T12:00:0${n}.000Z`,
})

describe('porcentaje de avance', () => {
  it('ahorrado / objetivo × 100: $200.000 de $1.000.000 = 20 %', () => {
    expect(progressPercent(20_000_000, 100_000_000)).toBe(20)
    expect(progressRatio(20_000_000, 100_000_000)).toBe(0.2)
  })

  it('nunca supera el 100 %, aunque se ahorre de más', () => {
    expect(progressPercent(150_000_000, 100_000_000)).toBe(100)
    expect(progressRatio(150_000_000, 100_000_000)).toBe(1)
  })

  it('no redondea hacia arriba: 99,9 % sigue siendo 99 %', () => {
    expect(progressPercent(99_900, 100_000)).toBe(99)
  })

  it('sin objetivo válido o sin ahorro es 0 %', () => {
    expect(progressPercent(0, 100_000)).toBe(0)
    expect(progressPercent(10, 0)).toBe(0)
  })
})

describe('resumen del frasco', () => {
  it('ahorrado = suma de aportes; falta nunca es negativa', () => {
    const j = jar()
    const list = [contribution(j, 20_000_000, '2026-10-06', 1), contribution(j, 5_000_000, '2026-10-07', 2)]
    expect(savedIn(j.id, list)).toBe(25_000_000)
    expect(jarSummary(j, list, '2026-10-08')).toMatchObject({ saved: 25_000_000, remaining: 75_000_000, percent: 25, completed: false })
    const over = [contribution(j, 120_000_000)]
    expect(jarSummary(j, over, '2026-10-08')).toMatchObject({ remaining: 0, percent: 100, completed: true, nextDate: null, contributionsLeft: 0 })
  })

  it('solo suma los aportes de su propio frasco', () => {
    const a = jar()
    const b = buildJar(input({ name: 'Auto' }), { now: NOW, newId: () => 'otro' })
    const list = [contribution(a, 1_000), { ...contribution(b, 9_000), id: 'x' }]
    expect(savedIn(a.id, list)).toBe(1_000)
    expect(savedIn(b.id, list)).toBe(9_000)
  })

  it('cada frecuencia tiene su próximo aporte: semanal +7, quincenal +14, mensual +1 mes', () => {
    const base = '2026-10-06'
    expect(addPeriod(base, 'WEEKLY')).toBe('2026-10-13')
    expect(addPeriod(base, 'BIWEEKLY')).toBe('2026-10-20')
    expect(addPeriod(base, 'MONTHLY')).toBe('2026-11-06')
    for (const [frequency, next] of [['WEEKLY', '2026-10-13'], ['BIWEEKLY', '2026-10-20'], ['MONTHLY', '2026-11-06']] as const) {
      const j = jar({ plan: { frequency, amount: 5_000_000 } })
      expect(jarSummary(j, [], base).nextDate).toBe(next)
    }
  })

  it('el próximo aporte se cuenta desde el último aporte', () => {
    const j = jar({ plan: { frequency: 'WEEKLY', amount: 5_000_000 } })
    const list = [contribution(j, 1_000, '2026-10-10')]
    expect(jarSummary(j, list, '2026-10-11').nextDate).toBe('2026-10-17')
  })

  it('el próximo aporte nunca supera lo que falta', () => {
    const j = jar({ targetAmount: 6_000_000, plan: { frequency: 'WEEKLY', amount: 5_000_000 } })
    const s = jarSummary(j, [contribution(j, 4_000_000)], '2026-10-06')
    expect(s.nextAmount).toBe(2_000_000)
    expect(s.contributionsLeft).toBe(1)
  })

  it('sin fecha objetivo se recomienda el aporte del plan; cuántos aportes faltan', () => {
    const j = jar()
    const s = jarSummary(j, [], '2026-10-06')
    expect(s.recommended).toBe(5_000_000)
    expect(s.contributionsLeft).toBe(20)
  })

  it('con fecha objetivo se recomienda lo necesario por período', () => {
    // Faltan $1.000.000 y 70 días: 10 semanas → $100.000 por semana; 5 quincenas → $200.000; 3 "meses" de 30 días → ceil.
    const weekly = jar({ targetDate: '2026-12-15', plan: { frequency: 'WEEKLY', amount: 5_000_000 } })
    expect(jarSummary(weekly, [], '2026-10-06').recommended).toBe(10_000_000)
    const biweekly = jar({ targetDate: '2026-12-15', plan: { frequency: 'BIWEEKLY', amount: 5_000_000 } })
    expect(jarSummary(biweekly, [], '2026-10-06').recommended).toBe(20_000_000)
    const monthly = jar({ targetDate: '2026-12-15', plan: { frequency: 'MONTHLY', amount: 5_000_000 } })
    expect(jarSummary(monthly, [], '2026-10-06').recommended).toBe(Math.ceil(100_000_000 / 3))
  })

  it('la recomendación se actualiza al agregar dinero', () => {
    const j = jar({ targetDate: '2026-12-15', plan: { frequency: 'WEEKLY', amount: 5_000_000 } })
    const s = jarSummary(j, [contribution(j, 50_000_000)], '2026-10-06')
    expect(s.recommended).toBe(5_000_000)
    expect(s.remaining).toBe(50_000_000)
  })

  it('una fecha objetivo vencida usa el aporte del plan', () => {
    const j = jar({ targetDate: '2026-10-07' })
    expect(jarSummary(j, [], '2026-10-20').recommended).toBe(5_000_000)
  })
})

describe('meses calendario', () => {
  it('suma meses y ajusta al último día del mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('dinero asignado y disponible', () => {
  it('saldo $1.000.000, frascos $300.000 → disponible $700.000', () => {
    const a = jar()
    const b = buildJar(input({ name: 'Auto' }), { now: NOW, newId: () => 'b' })
    const list = [contribution(a, 20_000_000, '2026-10-06', 1), { ...contribution(b, 10_000_000, '2026-10-06', 2), id: 'c-2' }]
    expect(savingsTotals(100_000_000, [a, b], list)).toEqual({
      balance: 100_000_000,
      assigned: 30_000_000,
      available: 70_000_000,
    })
  })

  it('sin frascos todo el saldo está disponible', () => {
    expect(savingsTotals(5_000, [], [])).toEqual({ balance: 5_000, assigned: 0, available: 5_000 })
  })

  it('agregar a un frasco NO cambia el saldo de la cuenta (no hay movimiento)', () => {
    const income = buildTransaction(
      { accountId: 'acc', type: 'INCOME', amount: 100_000_000, description: 'Sueldo', categoryId: 'inc-employment', date: '2026-10-01', time: '09:00' },
      { id: 't1', now: NOW },
    )
    const balance = computeBalance([income], undefined, 'ARS')
    const j = jar()
    const c = buildContribution(j, 30_000_000, { now: NOW, newId: ids() })
    const totals = savingsTotals(balance, [j], [c])
    expect(computeBalance([income], undefined, 'ARS')).toBe(100_000_000)
    expect(totals).toEqual({ balance: 100_000_000, assigned: 30_000_000, available: 70_000_000 })
  })

  it('un aporte no puede reservar más de lo disponible ni ser cero', () => {
    expect(validateContribution(70_000_000, 70_000_000)).toBeNull()
    expect(validateContribution(70_000_001, 70_000_000)).toBe('NOT_ENOUGH_AVAILABLE')
    expect(validateContribution(0, 70_000_000)).toBe('INVALID_AMOUNT')
    expect(validateContribution(-5, 70_000_000)).toBe('INVALID_AMOUNT')
  })

  it('mover dinero entre frascos no duplica: el total asignado es la suma de aportes', () => {
    const a = jar()
    const b = buildJar(input({ name: 'Auto' }), { now: NOW, newId: () => 'b' })
    const list = [contribution(a, 10_000), { ...contribution(b, 10_000), id: 'c-9' }]
    expect(savingsTotals(100_000, [a, b], list).assigned).toBe(20_000)
  })

  it('ignora aportes de frascos que no existen', () => {
    const a = jar()
    expect(savingsTotals(100_000, [a], [{ ...contribution(a, 5_000), jarId: 'fantasma' }]).assigned).toBe(0)
  })
})

describe('alta de frascos y aportes', () => {
  const today = '2026-10-06'

  it('crea el frasco con nombre recortado, objetivo y plan', () => {
    const j = buildJar(input({ name: '  Vacaciones  ' }), { now: NOW, newId: ids() })
    expect(j).toMatchObject({
      name: 'Vacaciones',
      targetAmount: 100_000_000,
      targetDate: null,
      plan: { frequency: 'MONTHLY', amount: 5_000_000 },
    })
    expect(j.createdAt).toBe(NOW.toISOString())
  })

  it('validación', () => {
    expect(validateNewJar(input(), today)).toEqual({})
    expect(validateNewJar(input({ name: '   ' }), today).name).toBeDefined()
    expect(validateNewJar(input({ name: 'x'.repeat(41) }), today).name).toBeDefined()
    expect(validateNewJar(input({ targetAmount: 0 }), today).targetAmount).toBeDefined()
    expect(validateNewJar(input({ plan: { frequency: 'WEEKLY', amount: 0 } }), today).planAmount).toBeDefined()
    expect(validateNewJar(input({ plan: { frequency: 'WEEKLY', amount: 200_000_000 } }), today).planAmount).toBeDefined()
    expect(validateNewJar(input({ targetDate: '2026-10-06' }), today).targetDate).toBeDefined()
    expect(validateNewJar(input({ targetDate: '2027-01-01' }), today)).toEqual({})
  })

  it('el aporte guarda frasco, monto y fecha; es inmutable (cada aporte es un registro nuevo)', () => {
    const j = jar()
    const newId = ids()
    const first = buildContribution(j, 1_000, { now: NOW, newId })
    const second = buildContribution(j, 2_000, { now: NOW, newId })
    expect(first).toMatchObject({ jarId: j.id, amount: 1_000, date: '2026-10-06' })
    expect(first.id).not.toBe(second.id)
  })
})
