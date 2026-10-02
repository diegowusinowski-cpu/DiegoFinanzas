import { describe, expect, it } from 'vitest'
import { computeBalance, computeBalanceByMethod } from './balance'
import type { Transaction } from './models'
import { buildTransaction, type NewTransactionInput } from './transactions'

let seq = 0
const tx = (over: Partial<NewTransactionInput> & { status?: Transaction['status'] }): Transaction => {
  const { status, ...rest } = over
  const built = buildTransaction(
    { accountId: 'acc', type: 'INCOME', amount: 1000, description: 'x', categoryId: 'c', date: '2026-10-06', time: '09:00', ...rest },
    { id: `t${++seq}`, now: new Date(2026, 9, 6, 12, 0, seq) },
  )
  return status ? { ...built, status } : built
}

describe('computeBalanceByMethod', () => {
  it('reparte el saldo entre efectivo y transferencia', () => {
    const list = [
      tx({ amount: 10_000, paymentMethod: 'CASH' }),
      tx({ amount: 3_000, type: 'EXPENSE', paymentMethod: 'CASH' }),
      tx({ amount: 50_000, paymentMethod: 'TRANSFER' }),
      tx({ amount: 20_000, type: 'EXPENSE', paymentMethod: 'TRANSFER' }),
    ]
    expect(computeBalanceByMethod(list)).toEqual({ cash: 7_000, transfer: 30_000, other: 0, total: 37_000 })
  })

  it('el total coincide siempre con el saldo de siempre', () => {
    const list = [
      tx({ amount: 10_000, paymentMethod: 'CASH' }),
      tx({ amount: 4_000, type: 'EXPENSE' }),
      tx({ amount: 700, paymentMethod: 'TRANSFER', status: 'CANCELLED' }),
      tx({ amount: 900, paymentMethod: 'CASH', status: 'SCHEDULED' }),
      tx({ amount: 5_000, paymentMethod: 'CASH' }),
    ]
    const result = computeBalanceByMethod(list)
    expect(result.total).toBe(computeBalance(list))
    expect(result.cash + result.transfer + result.other).toBe(result.total)
  })

  it('los movimientos sin medio de pago (p. ej. préstamos) van aparte', () => {
    const list = [tx({ amount: 8_000, paymentMethod: 'CASH' }), tx({ amount: 2_000, type: 'EXPENSE', paymentMethod: null })]
    expect(computeBalanceByMethod(list)).toEqual({ cash: 8_000, transfer: 0, other: -2_000, total: 6_000 })
  })

  it('no mezcla monedas y solo cuenta movimientos completados', () => {
    const list = [
      tx({ amount: 1_000, paymentMethod: 'CASH', currency: 'USD' }),
      tx({ amount: 2_000, paymentMethod: 'CASH' }),
      tx({ amount: 9_000, paymentMethod: 'CASH', status: 'CANCELLED' }),
    ]
    expect(computeBalanceByMethod(list).cash).toBe(2_000)
    expect(computeBalanceByMethod(list, 'USD').cash).toBe(1_000)
  })

  it('sin movimientos, todo en cero', () => {
    expect(computeBalanceByMethod([])).toEqual({ cash: 0, transfer: 0, other: 0, total: 0 })
  })
})
