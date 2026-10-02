import type { ReactNode } from 'react'
import { formatMoney, type BalanceByMethod } from '@/domain'
import { cx } from '../cx'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'

interface BalanceBreakdownSheetProps {
  open: boolean
  breakdown: BalanceByMethod
  /** Si el saldo está oculto en la tarjeta, acá también. */
  hidden: boolean
  onClose(): void
}

function Row({ icon, label, hint, amount, testId }: { icon: IconName | null; label: string; hint?: string; amount: string; testId: string }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span className="grid size-avatar shrink-0 place-items-center rounded-pill bg-sunken text-fg">
        {icon ? <Icon name={icon} /> : <Icon name="loan" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-subheading block text-fg">{label}</span>
        {hint ? <span className="block text-body-sm text-fg-soft">{hint}</span> : null}
      </span>
      <span data-testid={testId} className="type-number type-subheading shrink-0 text-right text-fg">
        {amount}
      </span>
    </li>
  )
}

/** Saldo de cuenta repartido en efectivo y transferencia. Es el mismo saldo de la tarjeta, solo desglosado. */
export function BalanceBreakdownSheet({ open, breakdown, hidden, onClose }: BalanceBreakdownSheetProps) {
  const money = (value: number): ReactNode => (hidden ? '$ ••••••' : formatMoney(value))
  const text = (value: number) => String(money(value))
  return (
    <Sheet open={open} onClose={onClose} title="Saldo de cuenta">
      <div className="flex flex-col pb-2">
        <ul className="divide-y divide-line">
          <Row icon="banknote" label="Efectivo" amount={text(breakdown.cash)} testId="balance-cash" />
          <Row icon="transfer" label="Transferencia" amount={text(breakdown.transfer)} testId="balance-transfer" />
          {breakdown.other !== 0 ? (
            <Row
              icon={null}
              label="Préstamos y otros"
              hint="Movimientos sin efectivo ni transferencia"
              amount={text(breakdown.other)}
              testId="balance-other"
            />
          ) : null}
        </ul>
        <div className={cx('mt-1 flex items-center justify-between gap-4 border-t border-line pt-3')}>
          <span className="text-body text-fg-soft">Total</span>
          <span data-testid="balance-total" className="type-money-sm type-number text-fg">
            {text(breakdown.total)}
          </span>
        </div>
        <p className="mt-3 text-body-sm text-fg-soft">
          Es el mismo saldo de la tarjeta, repartido según cómo registraste cada ingreso y gasto.
        </p>
      </div>
    </Sheet>
  )
}
