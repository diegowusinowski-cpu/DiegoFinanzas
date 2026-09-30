import type { TransactionType } from '@/domain'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { Sheet } from '../components/Sheet'

/** Elección de Ingreso/Gasto para el botón "+" de la barra inferior. */
export function TypeChooserSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose(): void
  onSelect(type: TransactionType): void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo movimiento">
      <ul className="pb-2">
        <OptionRow
          leading={<Icon name="arrow-down" />}
          title="Ingreso"
          subtitle="Dinero que recibís"
          onClick={() => onSelect('INCOME')}
        />
        <OptionRow
          leading={<Icon name="arrow-up" />}
          title="Gasto"
          subtitle="Dinero que pagás"
          onClick={() => onSelect('EXPENSE')}
        />
      </ul>
    </Sheet>
  )
}
