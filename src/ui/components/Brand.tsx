import { cx } from '../cx'

export const BRAND_SHORT = 'DWF'
export const BRAND_NAME = 'Dieto Wusinowski Finanzas'

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('text-2xl font-extrabold tracking-[-0.06em]', className)} aria-label={BRAND_NAME}>
      {BRAND_SHORT}
    </span>
  )
}

export function BrandFooter() {
  return (
    <footer className="flex flex-col items-center gap-1 pt-8 pb-4 text-center">
      <span className="text-3xl font-extrabold tracking-[-0.06em] text-ink/85">{BRAND_SHORT}</span>
      <span className="text-xs font-medium tracking-[0.14em] text-muted uppercase">{BRAND_NAME}</span>
    </footer>
  )
}
