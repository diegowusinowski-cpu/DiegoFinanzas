import type { CurrencyCode, MinorUnits } from './models.ts'

/** Tope defensivo: mantiene los montos dentro del rango de enteros seguros. */
export const MAX_MINOR_UNITS: MinorUnits = 9_999_999_999_999 // $ 99.999.999.999,99

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const arsCompactFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const usdFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `123456` → `$ 1.234,56` (ARS) · `US$ 1.234,56` (USD) */
export function formatMoney(minor: MinorUnits, currency: CurrencyCode = 'ARS'): string {
  const formatter = currency === 'USD' ? usdFormatter : arsFormatter
  return formatter.format(minor / 100).replace(/\u00a0/g, ' ')
}

/** Igual que `formatMoney` pero sin decimales cuando son `,00`. */
export function formatMoneyCompact(minor: MinorUnits): string {
  return arsCompactFormatter.format(minor / 100).replace(/\u00a0/g, ' ')
}

/** Formatea un monto con signo explícito (`+ $ 10,00` / `− $ 10,00`). */
export function formatSignedMoney(minor: MinorUnits, sign: 'positive' | 'negative'): string {
  const symbol = sign === 'positive' ? '+' : '−'
  return `${symbol} ${formatMoney(Math.abs(minor))}`
}

/**
 * Interpreta un monto escrito por una persona (es-AR) y lo pasa a centavos.
 * Acepta `1500`, `1.500`, `1.500,50`, `1500,5`, `1500.50`.
 * Devuelve `null` si no es un monto válido o supera el tope.
 */
export function parseAmountToMinor(input: string): MinorUnits | null {
  const text = input.trim().replace(/[\s$]/g, '')
  if (text === '' || !/^[\d.,]+$/.test(text)) return null

  let integerPart: string
  let decimalPart = ''

  const lastComma = text.lastIndexOf(',')
  if (lastComma !== -1) {
    // La coma es el separador decimal; los puntos son de miles.
    integerPart = text.slice(0, lastComma)
    decimalPart = text.slice(lastComma + 1)
    if (integerPart.includes(',') || decimalPart.includes('.')) return null
    if (!isValidThousands(integerPart)) return null
  } else {
    const dots = text.split('.').length - 1
    const lastDot = text.lastIndexOf('.')
    const trailing = text.slice(lastDot + 1)
    if (dots === 1 && trailing.length !== 3) {
      // `1500.50` → punto decimal.
      integerPart = text.slice(0, lastDot)
      decimalPart = trailing
    } else if (dots >= 1) {
      // `1.500` / `1.500.000` → puntos de miles.
      if (!isValidThousands(text)) return null
      integerPart = text
    } else {
      integerPart = text
    }
  }

  if (decimalPart.length > 2) return null
  const digits = integerPart.replace(/\./g, '')
  if (digits === '' && decimalPart === '') return null
  if (digits !== '' && !/^\d+$/.test(digits)) return null
  if (decimalPart !== '' && !/^\d+$/.test(decimalPart)) return null

  const cents =
    Number(digits === '' ? '0' : digits) * 100 + Number(decimalPart.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(cents) || cents > MAX_MINOR_UNITS) return null
  return cents
}

function isValidThousands(value: string): boolean {
  if (!value.includes('.')) return /^\d*$/.test(value)
  return /^\d{1,3}(\.\d{3})+$/.test(value)
}
