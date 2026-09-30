import { describe, expect, it } from 'vitest'
import { MAX_MINOR_UNITS, formatMoney, formatMoneyCompact, formatSignedMoney, parseAmountToMinor } from './money'

describe('parseAmountToMinor', () => {
  it.each([
    ['1500', 150000],
    ['1.500', 150000],
    ['1.500.000', 150000000],
    ['1.500,50', 150050],
    ['1500,5', 150050],
    ['1500.50', 150050],
    ['0,99', 99],
    ['0,5', 50],
    [',5', 50],
    ['$ 2.000', 200000],
    ['  12  ', 1200],
    ['1500.5', 150050],
  ])('interpreta %s como %i centavos', (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '12a', '1,2,3', '1.5,2.3', '10,999', '1..000', '12.34.567', '-5', '1.50,0.', ','])(
    'rechaza %j',
    (input) => {
      expect(parseAmountToMinor(input)).toBeNull()
    },
  )

  it('rechaza montos por encima del tope', () => {
    expect(parseAmountToMinor('999.999.999.999.999')).toBeNull()
    expect(parseAmountToMinor('99.999.999.999,99')).toBe(MAX_MINOR_UNITS)
  })

  it('no tiene errores de punto flotante', () => {
    expect(parseAmountToMinor('0,29')).toBe(29)
    expect(parseAmountToMinor('1,15')).toBe(115)
    expect(parseAmountToMinor('19,99')).toBe(1999)
  })
})

describe('formato de montos', () => {
  it('formatea en pesos argentinos', () => {
    expect(formatMoney(123456)).toBe('$ 1.234,56')
    expect(formatMoney(0)).toBe('$ 0,00')
    expect(formatMoney(-2500)).toContain('25,00')
  })
  it('compacta sin decimales redundantes', () => {
    expect(formatMoneyCompact(150000)).toBe('$ 1.500')
    expect(formatMoneyCompact(150050)).toBe('$ 1.500,5')
  })
  it('agrega signo explícito', () => {
    expect(formatSignedMoney(1000, 'positive')).toBe('+ $ 10,00')
    expect(formatSignedMoney(1000, 'negative')).toBe('− $ 10,00')
  })
})

describe('formatMoney por moneda', () => {
  it('USD lleva su propio prefijo', () => {
    expect(formatMoney(123456, 'USD')).toBe('US$ 1.234,56')
    expect(formatMoney(123456)).toBe('$ 1.234,56')
  })
})
