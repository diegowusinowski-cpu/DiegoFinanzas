import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-soft active:scale-[0.98]',
  secondary: 'bg-sunken text-ink hover:bg-line active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-soft hover:bg-sunken',
  danger: 'bg-expense text-white hover:opacity-90 active:scale-[0.98]',
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
        'inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition duration-150 disabled:opacity-50',
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
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
