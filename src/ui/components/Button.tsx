import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

/**
 * Variantes del sistema:
 *  - primary:     acción principal (verde bosque)
 *  - secondary:   acción de apoyo (arena)
 *  - tertiary:    acción discreta, sin fondo
 *  - destructive: acción irreversible o riesgosa
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-on-action hover:bg-action-hover active:bg-action-pressed',
  secondary: 'bg-sunken text-fg hover:bg-sunken-hover active:bg-sunken-hover',
  tertiary: 'bg-transparent text-fg hover:bg-glass active:bg-glass-strong',
  destructive: 'bg-danger-bg text-danger hover:bg-danger/15 active:bg-danger/20',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 gap-1.5 px-5 text-body-sm',
  md: 'min-h-control-h gap-2 px-7 type-button',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
}

/** Botón en píldora. Es la forma estándar de los botones de texto. */
export function Button({
  variant = 'primary',
  size = 'md',
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
        'interactive inline-flex items-center justify-center rounded-pill font-medium',
        SIZES[size],
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

export type IconButtonSize = 'sm' | 'md' | 'lg'

const ICON_BUTTON_SIZES: Record<IconButtonSize, string> = {
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-14',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatorio: el botón no tiene texto visible. */
  'aria-label': string
  variant?: ButtonVariant
  size?: IconButtonSize
}

/** Botón circular solo con ícono (alto táctil mínimo por tamaño). */
export function IconButton({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'interactive grid shrink-0 place-items-center rounded-pill',
        ICON_BUTTON_SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
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
