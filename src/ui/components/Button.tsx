import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  loading?: boolean
}

/** Variantes del sistema: blanco sobre negro es la única acción primaria. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-action text-fg-on-action hover:bg-cloud active:bg-silver',
  secondary: 'border border-line bg-glass text-fg hover:bg-glass-strong active:bg-surface-hover',
  ghost: 'bg-transparent text-fg-soft hover:bg-glass active:bg-glass-strong',
  danger: 'border border-danger/40 bg-transparent text-danger hover:bg-danger/10 active:bg-danger/20',
}

export function Button({
  variant = 'primary',
  block = false,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex min-h-13 items-center justify-center gap-2 rounded-pill px-7 text-body font-normal transition-colors duration-200 ease-out disabled:opacity-40',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cx(
        'inline-block size-4 animate-spin rounded-pill border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
