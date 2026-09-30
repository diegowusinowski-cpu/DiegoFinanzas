export const BRAND_SHORT = 'DWF'
export const BRAND_NAME = 'Dieto Wusinowski Finanzas'

/** Firma de marca al pie: sello tonal discreto, como marca de agua. */
export function BrandFooter() {
  return (
    <footer className="flex flex-col items-center gap-1.5 pt-6 pb-2 text-center">
      <span className="text-[2.5rem] leading-none font-semibold tracking-[-0.045em] text-sunken-hover">{BRAND_SHORT}</span>
      <span className="text-caption text-fg-muted">{BRAND_NAME}</span>
    </footer>
  )
}
