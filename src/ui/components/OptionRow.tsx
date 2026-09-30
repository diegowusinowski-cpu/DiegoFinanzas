import type { ReactNode } from 'react'

interface OptionRowProps {
  /** Avatar a la izquierda (bandera, ícono). */
  leading: ReactNode
  title: string
  subtitle?: string
  onClick(): void
}

/** Fila de opción de lista: avatar, título, apoyo y chevron (patrón de listas de selección). */
export function OptionRow({ leading, title, subtitle, onClick }: OptionRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="interactive -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-card px-2 py-3 text-left hover:bg-glass active:bg-glass-strong"
      >
        <span className="grid size-avatar shrink-0 place-items-center overflow-hidden rounded-pill bg-sunken">
          {leading}
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-subheading block text-fg">{title}</span>
          {subtitle ? <span className="block text-body-sm text-fg-soft">{subtitle}</span> : null}
        </span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-fg-muted"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </li>
  )
}
