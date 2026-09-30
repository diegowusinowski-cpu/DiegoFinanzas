import { describe, expect, it } from 'vitest'
import { appendAmountKey, formatAmountInput, MAX_INTEGER_DIGITS } from './amountInput'
import { parseAmountToMinor } from './money'

const type = (keys: string) => [...keys].reduce((raw, key) => appendAmountKey(raw, key === 'b' ? 'backspace' : key), '')

describe('appendAmountKey', () => {
  it('acumula dígitos y evita ceros a la izquierda', () => {
    expect(type('123')).toBe('123')
    expect(type('0005')).toBe('5')
    expect(type('0')).toBe('0')
  })

  it('acepta una sola coma y hasta 2 decimales', () => {
    expect(type('12,5')).toBe('12,5')
    expect(type('12,,5')).toBe('12,5')
    expect(type('12,567')).toBe('12,56')
    expect(type(',5')).toBe('0,5')
  })

  it('borra de a un carácter', () => {
    expect(type('12,5bb')).toBe('12')
    expect(type('1b')).toBe('')
    expect(type('bbb')).toBe('')
  })

  it('limita la cantidad de dígitos enteros', () => {
    expect(type('9'.repeat(30)).length).toBe(MAX_INTEGER_DIGITS)
  })

  it('ignora teclas desconocidas', () => {
    expect(appendAmountKey('12', 'x')).toBe('12')
  })
})

describe('formatAmountInput', () => {
  it.each([
    ['', '0'],
    ['0', '0'],
    ['7', '7'],
    ['1000', '1.000'],
    ['10000', '10.000'],
    ['1234567', '1.234.567'],
    ['10000,5', '10.000,5'],
    ['10000,50', '10.000,50'],
    ['0,', '0,'],
  ])('%j → %j', (raw, expected) => {
    expect(formatAmountInput(raw)).toBe(expected)
  })

  it('el texto crudo se convierte a centavos exactos', () => {
    expect(parseAmountToMinor('10000,5')).toBe(1_000_050)
    expect(parseAmountToMinor('0,')).toBe(0)
    expect(parseAmountToMinor('99999999999,99')).toBe(9_999_999_999_999)
  })
})
