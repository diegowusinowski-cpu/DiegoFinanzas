import { formatMoney, formatRelativeDate, type DetectedService } from '@/domain'
import { Icon } from './Icon'
import { categoryIcon } from '../movements/categoryIcon'

/** Fila de un gasto de servicio: ícono, nombre, fecha, importe y moneda. */
export function ServiceItem({ service, today }: { service: DetectedService; today: string }) {
  const { transaction: t } = service
  const amount = formatMoney(t.amount, t.currency)
  return (
    <li className="flex items-center gap-3 py-row">
      <span className="grid size-avatar shrink-0 place-items-center rounded-pill bg-sunken text-fg">
        <Icon name={service.icon ?? categoryIcon(t.categoryId, t.type)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-subheading truncate text-fg">{service.name}</p>
        <p className="truncate text-body-sm text-fg-soft">
          {formatRelativeDate(t.date, today)}, {t.time}
        </p>
      </div>
      <div className="shrink-0 text-right" aria-label={`${service.name}: ${amount}`}>
        <p className="type-number type-subheading text-fg">− {amount}</p>
        <p className="text-caption text-fg-soft">{t.currency}</p>
      </div>
    </li>
  )
}
