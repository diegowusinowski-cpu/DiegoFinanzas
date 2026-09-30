import { diffInDays, formatDayMonthTitleCase, isValidLocalDate, toIso } from './datetime'
import type { EntityId, LocalDate, Reminder, ReminderSource } from './models'

export const MAX_REMINDER_TITLE_LENGTH = 60
export const MAX_REMINDER_DESCRIPTION_LENGTH = 200

export interface NewReminderInput {
  title: string
  description: string
  dueDate: LocalDate
  source?: ReminderSource
}

export type ReminderField = 'title' | 'description' | 'dueDate'
export type ReminderErrors = Partial<Record<ReminderField, string>>

export function validateNewReminder(input: NewReminderInput): ReminderErrors {
  const errors: ReminderErrors = {}
  const title = input.title.trim()
  if (title === '') errors.title = 'Escribí un título.'
  else if (title.length > MAX_REMINDER_TITLE_LENGTH) {
    errors.title = `Máximo ${MAX_REMINDER_TITLE_LENGTH} caracteres.`
  }
  if (input.description.trim().length > MAX_REMINDER_DESCRIPTION_LENGTH) {
    errors.description = `Máximo ${MAX_REMINDER_DESCRIPTION_LENGTH} caracteres.`
  }
  if (!isValidLocalDate(input.dueDate)) errors.dueDate = 'Fecha inválida.'
  return errors
}

export function buildReminder(input: NewReminderInput, meta: { id: EntityId; now: Date }): Reminder {
  const timestamp = toIso(meta.now)
  return {
    id: meta.id,
    title: input.title.trim(),
    description: input.description.trim(),
    dueDate: input.dueDate,
    status: 'ACTIVE',
    source: input.source ?? { kind: 'MANUAL' },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Recordatorios activos, el más próximo primero. */
export function activeReminders(reminders: readonly Reminder[]): Reminder[] {
  return reminders
    .filter((r) => r.status === 'ACTIVE')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt))
}

export type ReminderUrgency = 'overdue' | 'today' | 'soon' | 'later'

export function reminderUrgency(reminder: Reminder, today: LocalDate): ReminderUrgency {
  const days = diffInDays(today, reminder.dueDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 3) return 'soon'
  return 'later'
}

export function reminderDueLabel(reminder: Reminder, today: LocalDate): string {
  const days = diffInDays(today, reminder.dueDate)
  if (days < 0) return days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence el ${formatDayMonthTitleCase(reminder.dueDate)}`
}

/**
 * Contrato para módulos futuros (préstamos, cuotas, cobros, movimientos
 * programados…): cada uno aporta recordatorios derivados de sus propios datos.
 * Los recordatorios generados se combinan con los manuales en la capa de estado.
 */
export interface ReminderGenerationContext {
  now: Date
  today: LocalDate
}

export interface ReminderGenerator {
  readonly kind: ReminderSource['kind']
  generate(context: ReminderGenerationContext): Promise<Reminder[]> | Reminder[]
}
