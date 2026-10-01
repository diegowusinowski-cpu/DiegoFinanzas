import { addDays, diffInDays, isValidLocalDate, toLocalDate } from './datetime'
import { MAX_MINOR_UNITS } from './money'
import type {
  EntityId,
  LocalDate,
  MinorUnits,
  SavingsContribution,
  SavingsFrequency,
  SavingsJar,
  SavingsPlan,
} from './models'

export const MAX_JAR_NAME_LENGTH = 40

export const FREQUENCY_LABEL: Record<SavingsFrequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
}

/** Unidad en singular (“por semana”). */
export const FREQUENCY_UNIT: Record<SavingsFrequency, string> = {
  WEEKLY: 'semana',
  BIWEEKLY: 'quincena',
  MONTHLY: 'mes',
}

/** Días de cada período para estimar cuántos faltan hasta la fecha objetivo (mes ≈ 30 días). */
const PERIOD_DAYS: Record<SavingsFrequency, number> = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 }

/* ── Cálculos de un frasco ──────────────────────────────────────────────── */

export function contributionsOf(jarId: EntityId, all: readonly SavingsContribution[]): SavingsContribution[] {
  return all.filter((c) => c.jarId === jarId)
}

/** Más recientes primero (los aportes nunca se modifican). */
export function sortContributions(list: readonly SavingsContribution[]): SavingsContribution[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.date.localeCompare(a.date))
}

/** Dinero ahorrado en un frasco = suma de sus aportes. */
export function savedIn(jarId: EntityId, all: readonly SavingsContribution[]): MinorUnits {
  return contributionsOf(jarId, all).reduce((sum, c) => sum + c.amount, 0)
}

/** ahorrado / objetivo × 100, sin superar nunca el 100 %. Devuelve un entero (se redondea hacia abajo). */
export function progressPercent(saved: MinorUnits, target: MinorUnits): number {
  if (target <= 0) return 0
  return Math.min(100, Math.floor((saved / target) * 100))
}

/** Proporción 0..1 para dibujar el progreso (nunca más de 1). */
export function progressRatio(saved: MinorUnits, target: MinorUnits): number {
  if (target <= 0) return 0
  return Math.min(1, Math.max(0, saved / target))
}

/** Suma `months` meses calendario; si el día no existe en el mes destino, usa el último día. */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(d, lastDay))}`
}

/** Fecha del aporte siguiente a `from` según la frecuencia del plan. */
export function addPeriod(from: LocalDate, frequency: SavingsFrequency): LocalDate {
  if (frequency === 'MONTHLY') return addMonths(from, 1)
  return addDays(from, PERIOD_DAYS[frequency])
}

export interface JarSummary {
  saved: MinorUnits
  remaining: MinorUnits
  percent: number
  ratio: number
  completed: boolean
  /** Monto recomendado por período para llegar al objetivo (a la fecha objetivo, si la hay). */
  recommended: MinorUnits
  /** Aportes que faltan si se cumple el plan configurado. */
  contributionsLeft: number
  /** Fecha del próximo aporte del plan; `null` si el frasco ya está completo. */
  nextDate: LocalDate | null
  /** Monto del próximo aporte del plan (nunca más de lo que falta). */
  nextAmount: MinorUnits
}

/**
 * Resumen de un frasco. El próximo aporte se cuenta desde el último aporte (o desde la creación
 * del frasco si todavía no hay ninguno).
 */
export function jarSummary(
  jar: SavingsJar,
  allContributions: readonly SavingsContribution[],
  today: LocalDate,
): JarSummary {
  const own = contributionsOf(jar.id, allContributions)
  const saved = own.reduce((sum, c) => sum + c.amount, 0)
  const remaining = Math.max(0, jar.targetAmount - saved)
  const completed = remaining === 0

  let recommended = Math.min(jar.plan.amount, remaining)
  if (!completed && jar.targetDate && jar.targetDate > today) {
    const periods = Math.max(1, Math.ceil(diffInDays(today, jar.targetDate) / PERIOD_DAYS[jar.plan.frequency]))
    recommended = Math.ceil(remaining / periods)
  }

  const lastDate = own.reduce<LocalDate | null>((latest, c) => (latest === null || c.date > latest ? c.date : latest), null)
  const base = lastDate ?? toLocalDate(new Date(jar.createdAt))
  return {
    saved,
    remaining,
    percent: progressPercent(saved, jar.targetAmount),
    ratio: progressRatio(saved, jar.targetAmount),
    completed,
    recommended,
    contributionsLeft: completed ? 0 : Math.ceil(remaining / Math.max(1, jar.plan.amount)),
    nextDate: completed ? null : addPeriod(base, jar.plan.frequency),
    nextAmount: Math.min(jar.plan.amount, remaining),
  }
}

/* ── Dinero asignado y disponible ───────────────────────────────────────── */

export interface SavingsTotals {
  /** Saldo total de la cuenta (no cambia por ahorrar). */
  balance: MinorUnits
  /** Dinero reservado en todos los frascos. */
  assigned: MinorUnits
  /** Saldo no asignado a ningún frasco: saldo total − asignado. */
  available: MinorUnits
}

/** El dinero de los frascos sigue dentro del saldo total: solo se identifica como reservado. */
export function savingsTotals(
  balance: MinorUnits,
  jars: readonly SavingsJar[],
  contributions: readonly SavingsContribution[],
): SavingsTotals {
  const ids = new Set(jars.map((j) => j.id))
  const assigned = contributions.filter((c) => ids.has(c.jarId)).reduce((sum, c) => sum + c.amount, 0)
  return { balance, assigned, available: balance - assigned }
}

/* ── Alta de frascos y aportes ──────────────────────────────────────────── */

export interface NewJarInput {
  name: string
  targetAmount: MinorUnits
  targetDate: LocalDate | null
  plan: SavingsPlan
}

export type JarField = 'name' | 'targetAmount' | 'targetDate' | 'planAmount'
export type JarErrors = Partial<Record<JarField, string>>

export function validateNewJar(input: NewJarInput, today: LocalDate): JarErrors {
  const errors: JarErrors = {}
  const name = input.name.trim()
  if (name === '') errors.name = 'Poné un nombre al frasco.'
  else if (name.length > MAX_JAR_NAME_LENGTH) errors.name = `Máximo ${MAX_JAR_NAME_LENGTH} caracteres.`

  if (!Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0) {
    errors.targetAmount = 'Ingresá un objetivo mayor a cero.'
  } else if (input.targetAmount > MAX_MINOR_UNITS) {
    errors.targetAmount = 'El objetivo es demasiado grande.'
  }

  if (!Number.isSafeInteger(input.plan.amount) || input.plan.amount <= 0) {
    errors.planAmount = 'Ingresá un monto a aportar mayor a cero.'
  } else if (!errors.targetAmount && input.plan.amount > input.targetAmount) {
    errors.planAmount = 'El aporte no puede superar el objetivo.'
  }

  if (input.targetDate !== null) {
    if (!isValidLocalDate(input.targetDate)) errors.targetDate = 'Fecha inválida.'
    else if (input.targetDate <= today) errors.targetDate = 'La fecha objetivo tiene que ser posterior a hoy.'
  }
  return errors
}

export function buildJar(input: NewJarInput, meta: { now: Date; newId: () => EntityId }): SavingsJar {
  const timestamp = meta.now.toISOString()
  return {
    id: meta.newId(),
    name: input.name.trim(),
    targetAmount: input.targetAmount,
    targetDate: input.targetDate,
    plan: { frequency: input.plan.frequency, amount: input.plan.amount },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export type ContributionError = 'INVALID_AMOUNT' | 'NOT_ENOUGH_AVAILABLE'

/** Un aporte debe ser positivo y no puede reservar más dinero del que está disponible (sin asignar). */
export function validateContribution(amount: MinorUnits, available: MinorUnits): ContributionError | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 'INVALID_AMOUNT'
  if (amount > available) return 'NOT_ENOUGH_AVAILABLE'
  return null
}

export function buildContribution(
  jar: SavingsJar,
  amount: MinorUnits,
  meta: { now: Date; newId: () => EntityId },
): SavingsContribution {
  return {
    id: meta.newId(),
    jarId: jar.id,
    amount,
    date: toLocalDate(meta.now),
    createdAt: meta.now.toISOString(),
  }
}

/** Frascos más recientes primero. */
export function sortJars(jars: readonly SavingsJar[]): SavingsJar[] {
  return [...jars].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
