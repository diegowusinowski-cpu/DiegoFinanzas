import { describe, expect, it } from 'vitest'
import { MAX_MINOR_UNITS } from './money'
import { USD_BALANCE_ID, buildUsdBalance, validateUsdBalance } from './manualBalance'

describe('saldo manual en dólares', () => {
  it('acepta cero y montos positivos', () => {
    expect(validateUsdBalance(0)).toBeNull()
    expect(validateUsdBalance(100_000)).toBeNull()
  })
  it('rechaza lo que no es un monto, los negativos y lo desmedido', () => {
    expect(validateUsdBalance(null)).toMatch(/monto válido/)
    expect(validateUsdBalance(-1)).toMatch(/negativo/)
    expect(validateUsdBalance(1.5)).not.toBeNull()
    expect(validateUsdBalance(MAX_MINOR_UNITS + 1)).toMatch(/grande/)
  })
  it('se guarda en dólares con un id fijo (un único saldo)', () => {
    const now = new Date(2026, 9, 6, 12, 0)
    expect(buildUsdBalance(100_000, now)).toEqual({ id: USD_BALANCE_ID, currency: 'USD', amount: 100_000, updatedAt: now.toISOString() })
  })
})
