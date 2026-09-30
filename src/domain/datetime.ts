import type { IsoTimestamp, LocalDate, LocalTime } from './models'

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toLocalTime(date: Date): LocalTime {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toIso(date: Date): IsoTimestamp {
  return date.toISOString()
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function isValidLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Clave ordenable lexicográficamente: `2026-10-06T14:30`. */
export function dateTimeKey(date: LocalDate, time: LocalTime): string {
  return `${date}T${time}`
}

/** Convierte fecha+hora locales a `Date` (hora local del dispositivo). */
export function localDateTimeToDate(date: LocalDate, time: LocalTime): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  return new Date(y, m - 1, d, hh, mm)
}

/** Diferencia en días de calendario entre dos fechas locales (`b - a`). */
export function diffInDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number]
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

const longDate = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })
const longDateWithYear = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** `2026-10-06` → `6 de octubre` */
export function formatDayMonth(date: LocalDate): string {
  return longDate.format(localDateTimeToDate(date, '00:00'))
}

/** `2026-10-06` → `6 de Octubre` (estilo usado en los recordatorios). */
export function formatDayMonthTitleCase(date: LocalDate): string {
  const [day = '', month = ''] = formatDayMonth(date).split(' de ')
  return `${day} de ${capitalize(month)}`
}

/** Etiqueta relativa para listas: `Hoy`, `Ayer` o `6 de octubre[ de 2025]`. */
export function formatRelativeDate(date: LocalDate, today: LocalDate): string {
  const diff = diffInDays(date, today)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff === -1) return 'Mañana'
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  const d = localDateTimeToDate(date, '00:00')
  return sameYear ? longDate.format(d) : longDateWithYear.format(d)
}

/** `2026-10-02` → `2 de octubre del 2026` (texto buscable). */
export function formatLongDateParts(date: LocalDate): string {
  return `${formatDayMonth(date)} del ${date.slice(0, 4)}`
}
