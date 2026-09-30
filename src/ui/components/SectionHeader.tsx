import type { ReactNode } from 'react'

interface SectionHeaderProps {
  id: string
  title: ReactNode
  /** Acción de bloque a la derecha (p. ej. "+ Agregar"). */
  action?: ReactNode
}

/** Título de sección + acción, con la misma alineación en todo el home. */
export function SectionHeader({ id, title, action }: SectionHeaderProps) {
  return (
    <div className="flex min-h-control-sm items-center justify-between gap-3">
      <h2 id={id} className="type-title">
        {title}
      </h2>
      {action}
    </div>
  )
}

/** Acción de texto discreta para encabezados de sección. */
export function SectionAction({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="interactive -mr-3 min-h-control-sm shrink-0 rounded-pill px-3 text-body-sm font-medium whitespace-nowrap text-fg-soft hover:bg-sunken hover:text-fg"
    >
      {children}
    </button>
  )
}
