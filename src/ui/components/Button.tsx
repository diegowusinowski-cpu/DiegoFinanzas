import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

/**
 * Variantes del sistema:
 *  - primary:     acción principal (verde bosque)
 *  - secondary:   acción de apoyo (arena)
 *  - tertiary:    acción discreta, sin fondo
 *  - destructive: acción irreversible o riesgosa
 *  - inverse / glass: primaria y secundaria sobre superficie financiera oscura
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'inverse' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-on-action hover:bg-action-hover active:bg-action-pressed',
  secondary: 'bg-sunken text-fg hover:bg-sunken-hover active:bg-sunken-hover',
  tertiary: 'bg-transparent text-fg hover:bg-glass active:bg-glass-strong',
  destructive: 'bg-danger-bg text-danger hover:bg-danger/15 active:bg-danger/20',
  inverse: 'bg-on-panel text-panel hover:bg-white active:bg-sand-200',
  glass: 'bg-glass-on-panel text-on-panel hover:bg-glass-on-panel-hover active:bg-glass-on-panel-hover',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-control-sm gap-1.5 px-4 text-body-sm font-medium',
  md: 'min-h-control-md gap-2 px-5 type-button',
  lg: 'min-h-control-lg gap-2 px-6 type-button',
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
  sm: 'size-control-sm',
  md: 'size-control-md',
  lg: 'size-control-lg',
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
