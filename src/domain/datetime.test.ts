import { describe, expect, it } from 'vitest'
import {
  diffInDays,
  formatDayMonthTitleCase,
  formatRelativeDate,
  isValidLocalDate,
  isValidLocalTime,
  toLocalDate,
  toLocalTime,
} from './datetime'

describe('datetime', () => {
  it('valida fechas y horas', () => {
    expect(isValidLocalDate('2026-10-06')).toBe(true)
    expect(isValidLocalDate('2026-02-30')).toBe(false)
    expect(isValidLocalDate('06/10/2026')).toBe(false)
    expect(isValidLocalTime('23:59')).toBe(true)
    expect(isValidLocalTime('24:00')).toBe(false)
    expect(isValidLocalTime('9:05')).toBe(false)
  })

  it('formatea fecha y hora locales', () => {
    const d = new Date(2026, 9, 6, 8, 5)
    expect(toLocalDate(d)).toBe('2026-10-06')
    expect(toLocalTime(d)).toBe('08:05')
  })

  it('calcula diferencias en días de calendario', () => {
    expect(diffInDays('2026-10-06', '2026-10-06')).toBe(0)
    expect(diffInDays('2026-10-06', '2026-10-09')).toBe(3)
    expect(diffInDays('2026-12-31', '2027-01-01')).toBe(1)
    expect(diffInDays('2026-10-06', '2026-10-01')).toBe(-5)
  })

  it('formatea etiquetas relativas', () => {
    expect(formatRelativeDate('2026-10-06', '2026-10-06')).toBe('Hoy')
    expect(formatRelativeDate('2026-10-05', '2026-10-06')).toBe('Ayer')
    expect(formatRelativeDate('2026-10-07', '2026-10-06')).toBe('Mañana')
    expect(formatRelativeDate('2026-03-01', '2026-10-06')).toBe('1 de marzo')
    expect(formatRelativeDate('2025-03-01', '2026-10-06')).toBe('1 de marzo de 2025')
  })

  it('formatea el día del recordatorio con mes capitalizado', () => {
    expect(formatDayMonthTitleCase('2026-10-06')).toBe('6 de Octubre')
  })
})
