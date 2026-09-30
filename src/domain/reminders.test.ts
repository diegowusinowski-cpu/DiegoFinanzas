import { describe, expect, it } from 'vitest'
import type { Reminder } from './models'
import {
  activeReminders,
  buildReminder,
  reminderDueLabel,
  reminderUrgency,
  validateNewReminder,
} from './reminders'

const NOW = new Date(2026, 9, 1, 9, 0)
const make = (id: string, dueDate: string, status: Reminder['status'] = 'ACTIVE'): Reminder => ({
  ...buildReminder({ title: id, description: '', dueDate }, { id, now: NOW }),
  status,
})

describe('reminders', () => {
  it('valida título y fecha', () => {
    expect(validateNewReminder({ title: '', description: '', dueDate: '2026-10-06' }).title).toBeDefined()
    expect(validateNewReminder({ title: 'x', description: '', dueDate: '31/12/2026' }).dueDate).toBeDefined()
    expect(validateNewReminder({ title: 'Cuota', description: 'ok', dueDate: '2026-10-06' })).toEqual({})
  })

  it('crea recordatorios manuales activos por defecto', () => {
    const r = buildReminder({ title: ' Cuota ', description: ' d ', dueDate: '2026-10-06' }, { id: '1', now: NOW })
    expect(r).toMatchObject({ title: 'Cuota', description: 'd', status: 'ACTIVE', source: { kind: 'MANUAL' } })
  })

  it('acepta un origen distinto para recordatorios generados', () => {
    const r = buildReminder(
      { title: 'Cuota 3/12', description: '', dueDate: '2026-10-06', source: { kind: 'INSTALLMENT', refId: 'loan-1' } },
      { id: '1', now: NOW },
    )
    expect(r.source).toEqual({ kind: 'INSTALLMENT', refId: 'loan-1' })
  })

  it('lista solo los activos, del más próximo al más lejano', () => {
    const list = [make('c', '2026-10-20'), make('a', '2026-10-02'), make('x', '2026-10-01', 'DISMISSED'), make('b', '2026-10-10')]
    expect(activeReminders(list).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('calcula urgencia y etiqueta', () => {
    expect(reminderUrgency(make('a', '2026-09-30'), '2026-10-01')).toBe('overdue')
    expect(reminderUrgency(make('a', '2026-10-01'), '2026-10-01')).toBe('today')
    expect(reminderUrgency(make('a', '2026-10-04'), '2026-10-01')).toBe('soon')
    expect(reminderUrgency(make('a', '2026-10-05'), '2026-10-01')).toBe('later')
    expect(reminderDueLabel(make('a', '2026-10-06'), '2026-10-01')).toBe('Vence el 6 de Octubre')
    expect(reminderDueLabel(make('a', '2026-10-02'), '2026-10-01')).toBe('Vence mañana')
    expect(reminderDueLabel(make('a', '2026-09-28'), '2026-10-01')).toBe('Venció hace 3 días')
  })
})
