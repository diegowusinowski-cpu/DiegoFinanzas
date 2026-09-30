import { formatAmountInput } from './amountInput'
import { diffInDays, formatDayMonth, formatLongDateParts, formatRelativeDate } from './datetime'
import { formatMoney } from './money'
import type { Category, LocalDate, Transaction, TransactionType } from './models'

/** Vista de la pantalla Movimientos: búsqueda, filtro por tipo y agrupación por período. */
export type MovementFilter = 'ALL' | TransactionType

export interface MovementQuery {
  filter: MovementFilter
  query: string
}

/** Minúsculas y sin tildes: "Préstamos" coincide con "prestamos". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function amountStrings(t: Transaction): string[] {
  const whole = Math.trunc(t.amount / 100)
  const cents = String(t.amount % 100).padStart(2, '0')
  const grouped = formatAmountInput(String(whole))
  return [
    formatMoney(t.amount, t.currency),
    `${grouped},${cents}`,
    `${whole},${cents}`,
    `${whole}.${cents}`,
    grouped,
    String(whole),
  ]
}

function dateStrings(date: LocalDate, today: LocalDate): string[] {
  const [y, m, d] = date.split('-') as [string, string, string]
  return [
    date,
    `${d}/${m}/${y}`,
    `${d}/${m}`,
    formatDayMonth(date),
    formatLongDateParts(date),
    formatRelativeDate(date, today),
    periodLabel(date, today),
  ]
}

/** Todo el texto contra el que se busca un movimiento: concepto, categoría, tipo, importe y fecha. */
export function searchHaystack(t: Transaction, categoryName: string, today: LocalDate): string {
  const type = t.type === 'INCOME' ? 'ingreso ingresos' : 'gasto gastos egreso'
  return normalizeText(
    [t.description, categoryName, type, t.currency, ...amountStrings(t), ...dateStrings(t.date, today)].join(' | '),
  )
}

/** Cada palabra buscada debe aparecer en algún dato del movimiento. */
export function matchesQuery(t: Transaction, categoryName: string, query: string, today: LocalDate): boolean {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = searchHaystack(t, categoryName, today)
  return tokens.every((token) => haystack.includes(token))
}

/**
 * Aplica filtro por tipo y búsqueda juntos. Conserva el orden recibido.
 * Con varias palabras se prefiere la frase completa ("2 de octubre"); si nada
 * la contiene, cada palabra debe aparecer en algún dato ("netflix octubre").
 */
export function filterMovements(
  movements: readonly Transaction[],
  { filter, query }: MovementQuery,
  categories: readonly Category[],
  today: LocalDate,
): Transaction[] {
  const byType = movements.filter((t) => filter === 'ALL' || t.type === filter)
  const nameOf = (t: Transaction) => categories.find((c) => c.id === t.categoryId)?.name ?? ''
  const phrase = normalizeText(query).trim().replace(/\s+/g, ' ')
  if (phrase === '') return byType

  const byTokens = byType.filter((t) => matchesQuery(t, nameOf(t), query, today))
  if (!phrase.includes(' ')) return byTokens
  const byPhrase = byType.filter((t) => searchHaystack(t, nameOf(t), today).includes(phrase))
  return byPhrase.length > 0 ? byPhrase : byTokens
}

const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' })

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function weekday(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

/**
 * Período de un día respecto de hoy: Próximos, Hoy, Ayer, Esta semana (lunes a
 * domingo), Este mes y, más atrás, el mes (con año si no es el actual).
 */
export function periodLabel(date: LocalDate, today: LocalDate): string {
  const ago = diffInDays(date, today) // días transcurridos desde `date` hasta hoy
  if (ago < 0) return 'Próximos'
  if (ago === 0) return 'Hoy'
  if (ago === 1) return 'Ayer'
  const sinceMonday = (weekday(today) + 6) % 7
  if (ago <= sinceMonday) return 'Esta semana'
  if (date.slice(0, 7) === today.slice(0, 7)) return 'Este mes'
  const [y, m] = date.split('-').map(Number) as [number, number]
  const name = capitalize(monthName.format(new Date(y, m - 1, 1)))
  return date.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${y}`
}

export interface MovementGroup {
  label: string
  items: Transaction[]
}

/** Agrupa una lista ya ordenada (más reciente primero) en períodos consecutivos. */
export function groupMovements(movements: readonly Transaction[], today: LocalDate): MovementGroup[] {
  const groups: MovementGroup[] = []
  for (const t of movements) {
    const label = periodLabel(t.date, today)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(t)
    else groups.push({ label, items: [t] })
  }
  return groups
}
