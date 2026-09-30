import { describe, expect, it } from 'vitest'
import { computeBalance } from './balance'
import {
  buildLoanBundle,
  calculateLoan,
  installmentDueDates,
  installmentsOf,
  interestFor,
  loanProgress,
  splitInstallments,
  totalWithInterest,
  validateNewLoan,
  type NewLoanInput,
} from './loans'

const NOW = new Date(2026, 9, 2, 15, 30)
const input = (over: Partial<NewLoanInput> = {}): NewLoanInput => ({
  accountId: 'acc-main',
  borrowerName: 'Carlos Mendoza',
  principalAmount: 10_000_000, // $ 100.000,00
  installmentCount: 10,
  loanDate: '2026-10-02',
  dueDate: '2027-04-02',
  ...over,
})
const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

describe('cálculo con interés fijo del 70 %', () => {
  it('ejemplo del enunciado: $100.000 → interés $70.000, total $170.000, 10 cuotas de $17.000', () => {
    const calc = calculateLoan(10_000_000, 10)
    expect(calc.interestPercent).toBe(70)
    expect(calc.interest).toBe(7_000_000)
    expect(calc.total).toBe(17_000_000)
    expect(calc.installmentAmount).toBe(1_700_000)
    expect(calc.installments).toEqual(Array(10).fill(1_700_000))
  })

  it('sin cantidad de cuotas solo calcula interés y total', () => {
    const calc = calculateLoan(10_000_000)
    expect(calc.total).toBe(17_000_000)
    expect(calc.installments).toEqual([])
    expect(calc.installmentAmount).toBeNull()
  })

  it.each([
    [0, 0],
    [100, 70],
    [10_000_000, 7_000_000],
    [12_345, 8_642], // 86,415 → redondea
    [1, 1],
  ])('interés de %i centavos = %i', (principal, interest) => {
    expect(interestFor(principal)).toBe(interest)
    expect(totalWithInterest(principal)).toBe(principal + interest)
  })

  it('las cuotas suman exactamente el total (sin perder centavos)', () => {
    for (const [total, count] of [[17_000_000, 7], [100, 3], [1, 5], [9_999_999, 12]] as const) {
      const parts = splitInstallments(total, count)
      expect(parts).toHaveLength(count)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
    }
  })

  it('la cuota del préstamo es la mayor cuando no divide exacto', () => {
    expect(calculateLoan(1_000_000, 3).installments).toEqual([566_667, 566_667, 566_666])
    expect(calculateLoan(1_000_000, 3).installmentAmount).toBe(566_667)
  })

  it('cantidades de cuotas inválidas no generan cuotas', () => {
    expect(splitInstallments(100, 0)).toEqual([])
    expect(splitInstallments(100, 1.5)).toEqual([])
  })
})

describe('vencimientos de cuotas', () => {
  it('se reparten parejo y la última vence en la fecha límite', () => {
    const dates = installmentDueDates('2026-10-02', '2027-04-02', 10)
    expect(dates).toHaveLength(10)
    expect(dates.at(-1)).toBe('2027-04-02')
    expect([...dates].sort()).toEqual(dates)
    expect(new Set(dates).size).toBe(10)
  })

  it('una sola cuota vence en la fecha límite', () => {
    expect(installmentDueDates('2026-10-02', '2026-11-02', 1)).toEqual(['2026-11-02'])
  })

  it('dos cuotas: mitad de camino y fecha límite', () => {
    expect(installmentDueDates('2026-10-01', '2026-10-31', 2)).toEqual(['2026-10-16', '2026-10-31'])
  })
})

describe('validación', () => {
  it('acepta un préstamo válido', () => {
    expect(validateNewLoan(input())).toEqual({})
  })

  it('el nombre es obligatorio', () => {
    expect(validateNewLoan(input({ borrowerName: '   ' })).borrowerName).toBeDefined()
    expect(validateNewLoan(input({ borrowerName: 'x'.repeat(61) })).borrowerName).toBeDefined()
  })

  it('monto, cuotas y fechas', () => {
    expect(validateNewLoan(input({ principalAmount: 0 })).principalAmount).toBeDefined()
    expect(validateNewLoan(input({ installmentCount: 0 })).installmentCount).toBeDefined()
    expect(validateNewLoan(input({ installmentCount: 361 })).installmentCount).toBeDefined()
    expect(validateNewLoan(input({ installmentCount: 15 }))).toEqual({}) // cantidades fuera de los atajos
    expect(validateNewLoan(input({ dueDate: '2026-10-02' })).dueDate).toBeDefined()
    expect(validateNewLoan(input({ dueDate: '2026-09-01' })).dueDate).toBeDefined()
    expect(validateNewLoan(input({ loanDate: '2026-13-01' })).loanDate).toBeDefined()
  })
})

describe('creación del préstamo', () => {
  const bundle = buildLoanBundle(input(), { now: NOW, newId: ids() })

  it('guarda todos los datos del préstamo', () => {
    expect(bundle.loan).toMatchObject({
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
      currency: 'ARS',
    })
    expect(bundle.loan.createdAt).toBe(bundle.loan.updatedAt)
  })

  it('crea las cuotas PENDIENTES relacionadas con el préstamo', () => {
    expect(bundle.installments).toHaveLength(10)
    bundle.installments.forEach((i, idx) => {
      expect(i).toMatchObject({
        loanId: bundle.loan.id,
        installmentNumber: idx + 1,
        amount: 1_700_000,
        status: 'PENDING',
        paidAt: null,
        paymentTransactionId: null,
      })
    })
    expect(bundle.installments.reduce((a, i) => a + i.amount, 0)).toBe(bundle.loan.totalAmount)
    expect(bundle.installments.at(-1)?.dueDate).toBe('2027-04-02')
  })

  it('registra UN solo movimiento GASTO por el monto prestado (sin el interés)', () => {
    expect(bundle.transaction).toMatchObject({
      type: 'EXPENSE',
      amount: 10_000_000,
      description: 'Préstamo a Carlos Mendoza',
      categoryId: 'exp-loans',
      date: '2026-10-02',
      currency: 'ARS',
      status: 'COMPLETED',
      loanId: bundle.loan.id,
    })
    expect(bundle.loan.transactionId).toBe(bundle.transaction.id)
  })

  it('el saldo baja exactamente el monto prestado: $500.000 → $400.000', () => {
    const before = buildLoanBundle(input({ principalAmount: 50_000_000, installmentCount: 1 }), { now: NOW, newId: ids() })
    // Saldo inicial simulado: un ingreso de $500.000 previo al préstamo.
    const income = { ...before.transaction, id: 'inc', type: 'INCOME' as const, amount: 50_000_000, loanId: null }
    const after = bundle.transaction
    expect(computeBalance([income])).toBe(50_000_000)
    expect(computeBalance([income, after])).toBe(40_000_000)
    expect(computeBalance([income, after])).not.toBe(33_000_000) // NO descuenta los $170.000
  })

  it('aunque la fecha del préstamo sea posterior, la salida se descuenta al crearlo', () => {
    const future = buildLoanBundle(input({ loanDate: '2026-11-01', dueDate: '2027-01-01' }), { now: NOW, newId: ids() })
    expect(future.transaction.status).toBe('COMPLETED')
    expect(future.transaction.date).toBe('2026-11-01')
    expect(computeBalance([future.transaction])).toBe(-10_000_000)
  })

  it('recorta el nombre', () => {
    expect(buildLoanBundle(input({ borrowerName: '  Ana  ' }), { now: NOW, newId: ids() }).transaction.description).toBe(
      'Préstamo a Ana',
    )
  })
})

describe('seguimiento', () => {
  const { loan, installments } = buildLoanBundle(input(), { now: NOW, newId: ids() })

  it('próxima cuota y conteos', () => {
    const progress = loanProgress(installments)
    expect(progress).toMatchObject({ paid: 0, pending: 10 })
    expect(progress.next?.installmentNumber).toBe(1)
  })

  it('con cuotas pagadas (estructura preparada)', () => {
    const paid = installments.map((i) => (i.installmentNumber <= 3 ? { ...i, status: 'PAID' as const, paidAt: NOW.toISOString() } : i))
    const progress = loanProgress(paid)
    expect(progress).toMatchObject({ paid: 3, pending: 7 })
    expect(progress.next?.installmentNumber).toBe(4)
  })

  it('sin cuotas pendientes no hay próxima', () => {
    const all = installments.map((i) => ({ ...i, status: 'PAID' as const }))
    expect(loanProgress(all).next).toBeNull()
  })

  it('installmentsOf filtra por préstamo y ordena por número', () => {
    let n = 0
    const other = buildLoanBundle(input({ borrowerName: 'Otra' }), { now: NOW, newId: () => `otro-${++n}` })
    const mixed = [...other.installments, ...[...installments].reverse()]
    const mine = installmentsOf(loan.id, mixed)
    expect(mine).toHaveLength(10)
    expect(mine.map((i) => i.installmentNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
