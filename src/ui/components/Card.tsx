import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from './Icon'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-card bg-surface shadow-card', className)} {...rest} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-xl bg-sunken', className)} />
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-sunken text-muted">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {children ? <p className="max-w-64 text-sm text-muted">{children}</p> : null}
    </div>
  )
}
