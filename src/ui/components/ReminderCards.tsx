import { reminderDueLabel, reminderUrgency, type Reminder } from '@/domain'
import { cx } from '../cx'
import { Card } from './Card'
import { Icon } from './Icon'

const URGENCY_STYLE = {
  overdue: 'bg-void text-pure',
  today: 'bg-deep-iris text-pure',
  soon: 'bg-deep-iris text-pure',
  later: 'bg-void/10 text-void',
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
      <Card variant="pale" className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cx(
              'rounded-pill px-3 py-1.5 font-mono text-[0.625rem] leading-none tracking-[0.12em] uppercase',
              URGENCY_STYLE[urgency],
            )}
          >
            {reminderDueLabel(reminder, today)}
          </span>
          <button
            type="button"
            onClick={() => onDismiss(reminder.id)}
            aria-label={`Descartar recordatorio: ${reminder.title}`}
            className="-mt-1.5 -mr-2 grid size-10 place-items-center rounded-pill text-void transition-colors duration-200 hover:bg-void/10 active:bg-void/20"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <h3 className="type-title text-void">{reminder.title}</h3>
        {reminder.description ? <p className="text-body-sm text-void/75">{reminder.description}</p> : null}
      </Card>
    </li>
  )
}
