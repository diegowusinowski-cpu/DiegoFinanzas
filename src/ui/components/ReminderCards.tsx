import { reminderDueLabel, reminderUrgency, type Reminder } from '@/domain'
import { cx } from '../cx'
import { IconButton } from './Button'
import { Icon } from './Icon'

const URGENCY = {
  overdue: { icon: 'bg-danger-bg text-danger', label: 'text-danger' },
  today: { icon: 'bg-warning-bg text-warning', label: 'text-warning' },
  soon: { icon: 'bg-warning-bg text-warning', label: 'text-warning' },
  later: { icon: 'bg-sunken text-fg', label: 'text-fg-soft' },
} as const

interface ReminderCardProps {
  reminder: Reminder
  today: string
  onDismiss(id: string): void
}

/** Fila de recordatorio: título, vencimiento (con color de urgencia) y detalle. */
export function ReminderCard({ reminder, today, onDismiss }: ReminderCardProps) {
  const urgency = URGENCY[reminderUrgency(reminder, today)]
  return (
    <li className="flex items-start gap-3 py-row">
      <span className={cx('grid size-avatar shrink-0 place-items-center rounded-pill', urgency.icon)}>
        <Icon name="bell" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="type-subheading text-fg">{reminder.title}</h3>
        <p className={cx('text-body-sm font-medium', urgency.label)}>{reminderDueLabel(reminder, today)}</p>
        {reminder.description ? (
          <p className="mt-0.5 line-clamp-2 text-body-sm text-fg-soft">{reminder.description}</p>
        ) : null}
      </div>
      <IconButton
        variant="tertiary"
        size="sm"
        onClick={() => onDismiss(reminder.id)}
        aria-label={`Descartar recordatorio: ${reminder.title}`}
        className="-mr-2 text-fg-soft"
      >
        <Icon name="close" size="sm" />
      </IconButton>
    </li>
  )
}
