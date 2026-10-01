import { cx } from '../cx'

export const BRAND_SHORT = 'DWF'
export const BRAND_NAME = 'Dieto Wusinowski Finanzas'

export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span
      className={cx(
        'font-semibold tracking-[-0.045em] text-fg',
        size === 'lg' ? 'text-[3rem] leading-none' : 'text-[1.375rem] leading-none',
        className,
      )}
      aria-label={BRAND_NAME}
    >
      {BRAND_SHORT}
    </span>
  )
}
