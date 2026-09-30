import { cx } from '../cx'

export const BRAND_SHORT = 'DWF'
export const BRAND_NAME = 'Dieto Wusinowski Finanzas'

export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span
      className={cx(
        'font-semibold tracking-[-0.05em] text-fg',
        size === 'lg' ? 'text-display-xl' : 'text-title',
        className,
      )}
      aria-label={BRAND_NAME}
    >
      {BRAND_SHORT}
    </span>
  )
}

export function BrandFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 pt-10 pb-4 text-center">
      <span className="text-display font-semibold tracking-[-0.05em] text-fg-muted">{BRAND_SHORT}</span>
      <span className="type-eyebrow text-fg-muted">{BRAND_NAME}</span>
    </footer>
  )
}
