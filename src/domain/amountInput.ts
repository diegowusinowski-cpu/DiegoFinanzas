/**
 * Entrada de montos con teclado numérico propio. El estado es un texto crudo
 * (`"10000,5"`): dígitos, como máximo una coma y hasta 2 decimales. La vista
 * lo formatea en es-AR (`10.000,5`).
 */
export const MAX_INTEGER_DIGITS = 11
const MAX_DECIMALS = 2

export function appendAmountKey(raw: string, key: string): string {
  if (key === 'backspace') return raw.slice(0, -1)

  if (key === ',') {
    if (raw.includes(',')) return raw
    return raw === '' ? '0,' : `${raw},`
  }

  if (!/^\d$/.test(key)) return raw
  const [integer = '', decimals] = raw.split(',')
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? raw : `${raw}${key}`
  }
  if (integer === '0') return key === '0' ? raw : key // sin ceros a la izquierda
  return integer.length >= MAX_INTEGER_DIGITS ? raw : `${raw}${key}`
}

/** `"10000,5"` → `"10.000,5"`; vacío → `"0"`. */
export function formatAmountInput(raw: string): string {
  if (raw === '') return '0'
  const [integer = '0', decimals] = raw.split(',')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimals === undefined ? grouped : `${grouped},${decimals}`
}
