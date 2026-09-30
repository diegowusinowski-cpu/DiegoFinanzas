import { reminderDueLabel, reminderUrgency, type Reminder } from '@/domain'
import { cx } from '../cx'
import { IconButton } from './Button'
import { Card } from './Card'
import { Icon } from './Icon'

const URGENCY_STYLE = {
  overdue: 'bg-danger-bg text-danger',
  today: 'bg-warning-bg text-warning',
  soon: 'bg-warning-bg text-warning',
  later: 'bg-glass-on-panel text-on-panel',
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
    <li className={cx('snap-start', single ? 'w-full' : 'w-[85%] shrink-0')}>
      <Card variant="panel" className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cx(
              'rounded-pill px-3 py-1.5 text-caption leading-none font-medium',
              URGENCY_STYLE[urgency],
            )}
          >
            {reminderDueLabel(reminder, today)}
          </span>
          <IconButton
            variant="tertiary"
            size="sm"
            onClick={() => onDismiss(reminder.id)}
            aria-label={`Descartar recordatorio: ${reminder.title}`}
            className="-mt-1 -mr-2 text-on-panel hover:bg-glass-on-panel active:bg-glass-on-panel"
          >
            <Icon name="close" size="sm" />
          </IconButton>
        </div>
        <h3 className="type-title text-on-panel">{reminder.title}</h3>
        {reminder.description ? <p className="text-body-sm text-on-panel-soft">{reminder.description}</p> : null}
      </Card>
    </li>
  )
}
