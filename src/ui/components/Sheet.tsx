import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import { Icon } from './Icon'

interface SheetProps {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Hoja modal desde abajo: Esc/scrim cierran, el foco queda dentro y se restaura. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const firstField = node?.querySelector<HTMLElement>('[data-autofocus]')
    ;(firstField ?? node)?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fade bg-scrim backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-md animate-sheet flex-col rounded-t-sheet bg-surface outline-none"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-pill bg-sunken-hover" aria-hidden="true" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 id={titleId} className="type-title">
            {title}
          </h2>
          <IconButton onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size="sm" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-6 pb-safe pt-2">{children}</div>
      </div>
    </div>
  )
}
