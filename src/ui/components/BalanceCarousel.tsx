import { useCallback, useRef, useState, type ReactNode } from 'react'
import { convertUsdToArs, diffInDays, formatMoney, toLocalDate, type MinorUnits } from '@/domain'
import type { ExchangeRate } from '@/services/rates'
import { cx } from '../cx'
import type { RateState } from '../hooks/useExchangeRate'
import { IconButton } from './Button'
import { Skeleton } from './Card'
import { Flag } from './Flags'
import { Icon } from './Icon'

/** `$ 7.199,50` → [`$ 7.199`, `,50`]: los centavos se muestran en tamaño menor. */
function splitCents(formatted: string): [string, string] {
  const at = formatted.lastIndexOf(',')
  return at === -1 ? [formatted, ''] : [formatted.slice(0, at), formatted.slice(at)]
}

/** "Actualizado hoy" / "ayer" / "28/09", según la fecha que informa la fuente (si no, cuándo se consultó). */
function freshness(rate: ExchangeRate, today: string): string {
  const date = toLocalDate(new Date(rate.updatedAt ?? rate.fetchedAt))
  const days = diffInDays(date, today)
  if (days <= 0) return 'Actualizado hoy'
  if (days === 1) return 'Actualizado ayer'
  return `Actualizado ${date.slice(8, 10)}/${date.slice(5, 7)}`
}

interface BalanceCarouselProps {
  /** Saldo en pesos (derivado de los movimientos). */
  ars: MinorUnits
  /** Dólares que la persona cargó a mano. */
  usd: MinorUnits
  loading: boolean
  /** Cotización del Dólar Blue (para mostrar el equivalente en pesos de esos dólares). */
  rate: RateState
  /** Fecha de hoy (`YYYY-MM-DD`). */
  today: string
  onEditUsd(): void
  /** Abre el detalle del saldo en pesos (efectivo y transferencia). Recibe si el saldo está oculto. */
  onOpenBreakdown(hidden: boolean): void
}

const PAGES = [
  { id: 'ars', label: 'Saldo en pesos' },
  { id: 'usd', label: 'Saldo en dólares' },
] as const

/**
 * Saldo sobre la superficie financiera. Página 1: pesos (🇦🇷, derivado de los movimientos). Deslizando
 * a la izquierda, página 2: los dólares que la persona cargó a mano (🇺🇸) con su equivalente en pesos al
 * valor del día. Ocupa el mismo alto que el saldo en pesos solo: los puntos y la cotización usan el
 * espacio libre que ya había alrededor.
 */
export function BalanceCarousel({ ars, usd, loading, rate, today, onEditUsd, onOpenBreakdown }: BalanceCarouselProps) {
  const [hidden, setHidden] = useState(false)
  const [page, setPage] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  const onScroll = useCallback(() => {
    const el = track.current
    if (!el || el.clientWidth === 0) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const goTo = (index: number) => {
    const el = track.current
    if (!el) return
    setPage(index)
    el.scrollTo?.({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  const toggle = () => setHidden((h) => !h)
  const arsText = hidden ? '$ ••••••' : formatMoney(ars)
  const usdText = hidden ? 'US$ ••••••' : formatMoney(usd, 'USD')
  const equivalent = rate.status === 'ready' ? convertUsdToArs(usd, rate.rate.sell) : null
  const usdCaption = loading
    ? 'USD • Cargando'
    : usd === 0
      ? 'USD • Tocá el lápiz para cargar tus dólares'
      : rate.status === 'loading'
        ? 'USD • Consultando cotización'
        : equivalent === null
          ? 'USD • Equivalente en pesos no disponible'
          : `≈ ${hidden ? '$ ••••••' : formatMoney(equivalent)} ARS`

  return (
    <section aria-labelledby="balance-label" className="relative">
      <h2 id="balance-label" className="sr-only">
        Saldo disponible
      </h2>
      <div
        ref={track}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carrusel"
        aria-label="Saldo por moneda"
        className="scrollbar-none -mx-gutter flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        <Slide label={PAGES[0].label} active={page === 0}>
          <AmountRow
            flag="AR"
            hidden={hidden}
            onToggle={toggle}
            amount={
              loading ? (
                <Skeleton className="h-11 w-52 bg-glass-on-panel" />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenBreakdown(hidden)}
                  aria-haspopup="dialog"
                  className="interactive block w-full rounded-control text-left"
                >
                  <Amount testId="balance" text={arsText} negative={ars < 0 && !hidden} />
                  <span className="sr-only">Ver el saldo en efectivo y por transferencia</span>
                </button>
              )
            }
          />
          <Caption>
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpenBreakdown(hidden)}
              aria-haspopup="dialog"
              className="interactive inline-flex max-w-full items-center gap-1 rounded-pill"
            >
              <span className="truncate">ARS • Datos de cuenta</span>
              <Icon name="chevron-right" size="sm" />
            </button>
          </Caption>
        </Slide>

        <Slide label={PAGES[1].label} active={page === 1}>
          <AmountRow
            flag="US"
            hidden={hidden}
            onToggle={toggle}
            extra={
              <IconButton
                variant="glass"
                size="sm"
                onClick={onEditUsd}
                disabled={loading}
                aria-label="Editar saldo en dólares"
                aria-haspopup="dialog"
                className="size-8 bg-transparent text-on-panel-soft hover:text-on-panel"
              >
                <Icon name="edit" size="sm" />
              </IconButton>
            }
            amount={
              loading ? (
                <Skeleton className="h-11 w-52 bg-glass-on-panel" />
              ) : (
                <Amount testId="balance-usd" text={usdText} negative={false} smallFrom={9} />
              )
            }
          />
          <Caption testId="balance-usd-equivalent">{usdCaption}</Caption>
        </Slide>
      </div>

      {/* Indicador de páginas: discreto, a la altura de la leyenda. */}
      <div role="group" aria-label="Elegir moneda" className="absolute right-0 bottom-0 flex h-6 items-center">
        {PAGES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={p.label}
            aria-current={page === i ? 'true' : undefined}
            className="interactive grid h-6 w-5 place-items-center rounded-pill"
          >
            <span
              className={cx(
                'block h-1.5 rounded-pill transition-all duration-300',
                page === i ? 'w-4 bg-on-panel' : 'w-1.5 bg-glass-on-panel-hover',
              )}
            />
          </button>
        ))}
      </div>

      {/* Cotización usada para el equivalente, en el espacio libre bajo la tarjeta de saldo. */}
      {page === 1 && !loading && rate.status === 'ready' ? (
        <p
          data-testid="rate-used"
          title={`Fuente: ${rate.rate.source.name}`}
          className="absolute inset-x-0 top-full mt-1 truncate text-caption leading-4 text-on-panel-soft"
        >
          USD 1 = {formatMoney(Math.round(rate.rate.sell * 100))} ARS · {freshness(rate.rate, today)}
        </p>
      ) : null}
    </section>
  )
}

function Slide({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-roledescription="página"
      aria-label={label}
      aria-hidden={active ? undefined : true}
      inert={!active}
      className="flex w-full shrink-0 snap-center flex-col justify-center gap-2 px-gutter"
    >
      {children}
    </div>
  )
}

function AmountRow({
  flag,
  hidden,
  onToggle,
  amount,
  extra,
}: {
  flag: 'AR' | 'US'
  hidden: boolean
  onToggle(): void
  amount: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Flag country={flag} />
      <div className="min-w-0 flex-1">{amount}</div>
      {extra}
      <IconButton
        variant="glass"
        size="sm"
        onClick={onToggle}
        aria-pressed={hidden}
        aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
        className="-mr-1.5 size-8 bg-transparent text-on-panel-soft hover:text-on-panel"
      >
        <Icon name={hidden ? 'eye-off' : 'eye'} size="sm" />
      </IconButton>
    </div>
  )
}

/** `smallFrom`: desde cuántos caracteres se achica la cifra para que no pase a dos renglones. */
function Amount({ testId, text, negative, smallFrom = 13 }: { testId: string; text: string; negative: boolean; smallFrom?: number }) {
  const [whole, cents] = splitCents(text)
  return (
    <p
      data-testid={testId}
      className={cx('break-words', text.length > smallFrom ? 'type-money-sm' : 'type-money', negative ? 'text-danger-on-panel' : 'text-on-panel')}
    >
      {whole}
      {cents ? <span className="type-money-cents">{cents}</span> : null}
    </p>
  )
}

/** Leyenda de la página (deja lugar a la derecha para el indicador de páginas). */
function Caption({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-testid={testId} className="truncate pr-12 text-body-sm text-on-panel-soft">
      {children}
    </p>
  )
}
