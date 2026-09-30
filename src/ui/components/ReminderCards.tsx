import { reminderDueLabel, reminderUrgency, type Reminder } from '@/domain'
import { cx } from '../cx'
import { Icon } from './Icon'

const URGENCY_STYLE = {
  overdue: 'bg-expense-bg text-expense',
  today: 'bg-warn-bg text-warn',
  soon: 'bg-warn-bg text-warn',
  later: 'bg-sunken text-ink-soft',
} as const

interface ReminderCardProps {
  reminder: Reminder
  today: string
  single: boolean
  onDismiss(id: string): void
}

export function ReminderCard({ reminder, today, single, onDismiss }: ReminderCardProps) {
  const urgency = reminderUrgency(reminder, today)
  return (
    <li
      className={cx(
        'relative flex snap-start flex-col gap-2 rounded-card bg-surface p-5 shadow-card',
        single ? 'w-full' : 'w-[85%] shrink-0',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', URGENCY_STYLE[urgency])}>
          {reminderDueLabel(reminder, today)}
        </span>
        <button
          type="button"
          onClick={() => onDismiss(reminder.id)}
          aria-label={`Descartar recordatorio: ${reminder.title}`}
          className="-mt-1 -mr-2 grid size-9 place-items-center rounded-full text-muted transition hover:bg-sunken"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <h3 className="text-lg leading-snug font-bold tracking-tight">{reminder.title}</h3>
      {reminder.description ? <p className="text-sm text-ink-soft">{reminder.description}</p> : null}
    </li>
  )
}
