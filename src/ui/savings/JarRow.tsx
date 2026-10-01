import { formatMoney, jarSummary, type SavingsContribution, type SavingsJar } from '@/domain'
import { JarIllustration } from './JarIllustration'

interface JarRowProps {
  jar: SavingsJar
  contributions: readonly SavingsContribution[]
  today: string
  onOpen(jar: SavingsJar): void
}

/** Fila del listado de frascos: ilustración, nombre, ahorrado / objetivo y progreso. */
export function JarRow({ jar, contributions, today, onOpen }: JarRowProps) {
  const summary = jarSummary(jar, contributions, today)
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(jar)}
        aria-label={`Frasco ${jar.name}. Ver detalle`}
        className="interactive -mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-card px-2 py-4 text-left hover:bg-glass active:bg-glass-strong"
      >
        <JarIllustration ratio={summary.ratio} label={`Frasco al ${summary.percent}%`} className="h-16 w-[3.2rem] shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between gap-3">
            <span className="type-subheading min-w-0 truncate text-fg">{jar.name}</span>
            <span className="shrink-0 rounded-pill bg-positive-bg px-2.5 py-1 text-caption leading-none font-medium text-positive">
              {summary.percent}%
            </span>
          </span>
          <span className="text-body-sm text-fg-soft">
            <span className="text-fg">{formatMoney(summary.saved)}</span> de {formatMoney(jar.targetAmount)}
          </span>
          <span
            role="progressbar"
            aria-label={`Progreso de ${jar.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percent}
            className="block h-1.5 overflow-hidden rounded-pill bg-sunken"
          >
            <span className="block h-full rounded-pill bg-positive-vivid" style={{ width: `${summary.ratio * 100}%` }} />
          </span>
        </span>
      </button>
    </li>
  )
}
