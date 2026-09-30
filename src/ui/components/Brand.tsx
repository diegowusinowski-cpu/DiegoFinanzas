import { cx } from '../cx'

export const BRAND_SHORT = 'DWF'
export const BRAND_NAME = 'Dieto Wusinowski Finanzas'

export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span
      className={cx(
        'font-semibold tracking-[-0.05em] text-fg',
        size === 'lg' ? 'text-[3rem] leading-none' : 'text-[1.375rem] leading-none',
        className,
      )}
      aria-label={BRAND_NAME}
    >
      {BRAND_SHORT}
    </span>
  )
}

/** Firma de marca al pie: sello tonal discreto, como marca de agua. */
export function BrandFooter() {
  return (
    <footer className="flex flex-col items-center gap-1.5 pt-6 pb-2 text-center">
      <span className="text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-sunken-hover">{BRAND_SHORT}</span>
      <span className="text-caption text-fg-muted">{BRAND_NAME}</span>
    </footer>
  )
}
