import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { computeBalance } from './balance'
import type { Transaction } from './models'
import {
  buildTransaction,
  cancelTransaction,
  latestTransactions,
  settleDueTransactions,
  sortByRecency,
  validateNewTransaction,
  type NewTransactionInput,
} from './transactions'

const NOW = new Date(2026, 9, 6, 12, 0)

const input = (over: Partial<NewTransactionInput> = {}): NewTransactionInput => ({
  accountId: 'acc',
  type: 'EXPENSE',
  amount: 1000,
  description: 'Café',
  categoryId: 'cat-expense-food',
  date: '2026-10-06',
  time: '09:00',
  ...over,
})

let seq = 0
const tx = (over: Partial<NewTransactionInput> & { status?: Transaction['status'] } = {}): Transaction => {
  const { status, ...rest } = over
  const built = buildTransaction(input(rest), { id: `t${++seq}`, now: new Date(NOW.getTime() + seq) })
  return status ? { ...built, status } : built
}

describe('validateNewTransaction', () => {
  it('acepta un movimiento válido', () => {
    expect(validateNewTransaction(input(), DEFAULT_CATEGORIES)).toEqual({})
  })

  it('exige monto positivo entero', () => {
    expect(validateNewTransaction(input({ amount: 0 }), DEFAULT_CATEGORIES).amount).toBeDefined()
    expect(validateNewTransaction(input({ amount: -5 }), DEFAULT_CATEGORIES).amount).toBeDefined()
    expect(validateNewTransaction(input({ amount: 10.5 }), DEFAULT_CATEGORIES).amount).toBeDefined()
  })

  it('exige descripción y limita su largo', () => {
    expect(validateNewTransaction(input({ description: '   ' }), DEFAULT_CATEGORIES).description).toBeDefined()
    expect(validateNewTransaction(input({ description: 'x'.repeat(81) }), DEFAULT_CATEGORIES).description).toBeDefined()
  })

  it('exige categoría existente y coherente con el tipo', () => {
    expect(validateNewTransaction(input({ categoryId: '' }), DEFAULT_CATEGORIES).categoryId).toBeDefined()
    expect(validateNewTransaction(input({ categoryId: 'nope' }), DEFAULT_CATEGORIES).categoryId).toBeDefined()
    expect(
      validateNewTransaction(input({ type: 'INCOME', categoryId: 'cat-expense-food' }), DEFAULT_CATEGORIES).categoryId,
    ).toBeDefined()
  })

  it('valida fecha y hora', () => {
    const errors = validateNewTransaction(input({ date: '2026-13-01', time: '25:00' }), DEFAULT_CATEGORIES)
    expect(errors.date).toBeDefined()
    expect(errors.time).toBeDefined()
  })
})

describe('buildTransaction', () => {
  it('normaliza y completa la auditoría', () => {
    const t = buildTransaction(input({ description: '  Café  ' }), { id: 'x', now: NOW })
    expect(t.description).toBe('Café')
    expect(t.status).toBe('COMPLETED')
    expect(t.createdAt).toBe(t.updatedAt)
  })

  it('un movimiento futuro nace SCHEDULED', () => {
    expect(buildTransaction(input({ date: '2026-10-07' }), { id: 'x', now: NOW }).status).toBe('SCHEDULED')
    expect(buildTransaction(input({ date: '2026-10-06', time: '12:01' }), { id: 'x', now: NOW }).status).toBe('SCHEDULED')
    expect(buildTransaction(input({ date: '2026-10-06', time: '12:00' }), { id: 'x', now: NOW }).status).toBe('COMPLETED')
  })
})

describe('computeBalance', () => {
  it('es 0 sin movimientos', () => {
    expect(computeBalance([])).toBe(0)
  })

  it('suma ingresos y resta gastos', () => {
    const list = [
      tx({ type: 'INCOME', categoryId: 'cat-income-salary', amount: 500000 }),
      tx({ amount: 120050 }),
      tx({ amount: 30000 }),
    ]
    expect(computeBalance(list)).toBe(500000 - 120050 - 30000)
  })

  it('puede ser negativo', () => {
    expect(computeBalance([tx({ amount: 100 })])).toBe(-100)
  })

  it('ignora programados y cancelados', () => {
    const list = [
      tx({ type: 'INCOME', categoryId: 'cat-income-salary', amount: 1000 }),
      tx({ amount: 400, status: 'SCHEDULED' }),
      tx({ amount: 300, status: 'CANCELLED' }),
    ]
    expect(computeBalance(list)).toBe(1000)
  })

  it('filtra por cuenta', () => {
    const list = [tx({ accountId: 'a', amount: 100 }), tx({ accountId: 'b', amount: 250 })]
    expect(computeBalance(list, 'b')).toBe(-250)
  })
})

describe('latestTransactions', () => {
  it('devuelve exactamente los 3 más recientes por fecha/hora', () => {
    const list = [
      tx({ description: 'a', date: '2026-10-01', time: '10:00' }),
      tx({ description: 'b', date: '2026-10-05', time: '10:00' }),
      tx({ description: 'c', date: '2026-10-05', time: '18:30' }),
      tx({ description: 'd', date: '2026-10-06', time: '08:00' }),
      tx({ description: 'e', date: '2026-09-30', time: '23:59' }),
    ]
    expect(latestTransactions(list, 3).map((t) => t.description)).toEqual(['d', 'c', 'b'])
  })

  it('desempata por orden de alta', () => {
    const list = [tx({ description: 'primero' }), tx({ description: 'segundo' })]
    expect(latestTransactions(list, 3).map((t) => t.description)).toEqual(['segundo', 'primero'])
  })

  it('excluye programados y cancelados', () => {
    const list = [
      tx({ description: 'ok' }),
      tx({ description: 'prog', status: 'SCHEDULED' }),
      tx({ description: 'canc', status: 'CANCELLED' }),
    ]
    expect(latestTransactions(list, 3).map((t) => t.description)).toEqual(['ok'])
  })

  it('devuelve menos de 3 cuando hay menos', () => {
    expect(latestTransactions([tx()], 3)).toHaveLength(1)
    expect(latestTransactions([], 3)).toEqual([])
  })

  it('no muta la lista original', () => {
    const list = [tx({ date: '2026-10-01' }), tx({ date: '2026-10-05' })]
    const copy = [...list]
    sortByRecency(list)
    expect(list).toEqual(copy)
  })
})

describe('ciclo de vida', () => {
  it('cancelar conserva el movimiento y saca su efecto del saldo', () => {
    const original = tx({ amount: 700 })
    const cancelled = cancelTransaction(original, new Date(NOW.getTime() + 60_000))
    expect(cancelled.id).toBe(original.id)
    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.updatedAt).not.toBe(original.updatedAt)
    expect(computeBalance([cancelled])).toBe(0)
    expect(cancelTransaction(cancelled, NOW)).toBe(cancelled)
  })

  it('los programados vencidos pasan a COMPLETED y empiezan a contar', () => {
    const future = buildTransaction(input({ date: '2026-10-07', time: '09:00' }), { id: 'f', now: NOW })
    expect(computeBalance([future])).toBe(0)

    const before = settleDueTransactions([future], new Date(2026, 9, 7, 8, 59))
    expect(before.changed).toHaveLength(0)

    const after = settleDueTransactions([future], new Date(2026, 9, 7, 9, 0))
    expect(after.changed).toHaveLength(1)
    expect(after.transactions[0]?.status).toBe('COMPLETED')
    expect(computeBalance(after.transactions)).toBe(-1000)
  })
})
