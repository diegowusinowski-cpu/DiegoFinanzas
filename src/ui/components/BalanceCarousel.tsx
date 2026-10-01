import { useCallback, useRef, useState } from 'react'
import { convertArsToUsd, formatMoney, type MinorUnits } from '@/domain'
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

interface BalanceCarouselProps {
  /** Saldo en pesos (derivado de los movimientos). */
  ars: MinorUnits
  /** Saldo registrado en dólares (movimientos en USD). */
  usd: MinorUnits
  loading: boolean
  /** Cotización disponible del Dólar Blue (para pasar los pesos a dólares). */
  rate: RateState
}

const PAGES = [
  { id: 'ars', label: 'Saldo en pesos' },
  { id: 'usd', label: 'Saldo en dólares' },
] as const

/**
 * Saldo sobre la superficie financiera: página 1 en pesos (🇦🇷, la principal) y, deslizando hacia la
 * izquierda, página 2 en dólares (🇺🇸). El saldo en USD suma lo registrado en dólares más los pesos
 * convertidos con la cotización venta disponible; sin cotización muestra "No disponible".
 */
export function BalanceCarousel({ ars, usd, loading, rate }: BalanceCarouselProps) {
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

  const arsText = hidden ? '$ ••••••' : formatMoney(ars)
  const converted = rate.status === 'ready' ? convertArsToUsd(ars, rate.rate.sell) : null
  const usdMinor = converted === null ? null : usd + converted
  const usdText = hidden ? 'US$ ••••••' : usdMinor === null ? null : formatMoney(usdMinor, 'USD')
  const usdLoading = loading || rate.status === 'loading'

  return (
    <section aria-labelledby="balance-label" className="flex flex-col gap-4">
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
            onToggle={() => setHidden((h) => !h)}
            amount={
              loading ? (
                <Skeleton className="h-11 w-52 bg-glass-on-panel" />
              ) : (
                <Amount testId="balance" text={arsText} negative={ars < 0 && !hidden} />
              )
            }
          />
          <Caption hint="next">ARS • Datos de cuenta</Caption>
        </Slide>

        <Slide label={PAGES[1].label} active={page === 1}>
          <AmountRow
            flag="US"
            hidden={hidden}
            onToggle={() => setHidden((h) => !h)}
            amount={
              usdLoading ? (
                <Skeleton className="h-11 w-52 bg-glass-on-panel" />
              ) : usdText === null ? (
                <p data-testid="balance-usd" className="type-title text-on-panel-soft">
                  No disponible
                </p>
              ) : (
                <Amount testId="balance-usd" text={usdText} negative={(usdMinor ?? 0) < 0 && !hidden} />
              )
            }
          />
          <Caption hint="prev">
            {usdLoading
              ? 'USD • Consultando cotización'
              : usdText === null
                ? 'USD • Sin cotización del dólar por ahora'
                : 'USD • Equivalente al dólar blue'}
          </Caption>
        </Slide>
      </div>

      <div role="group" aria-label="Elegir moneda" className="-my-2 flex justify-center">
        {PAGES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={p.label}
            aria-current={page === i ? 'true' : undefined}
            className="interactive grid h-6 w-7 place-items-center rounded-pill"
          >
            <span
              className={cx(
                'block h-1.5 rounded-pill transition-all duration-300',
                page === i ? 'w-5 bg-on-panel' : 'w-1.5 bg-glass-on-panel-hover',
              )}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

function Slide({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-roledescription="página"
      aria-label={label}
      aria-hidden={active ? undefined : true}
      className="flex w-full shrink-0 snap-center flex-col gap-2 px-gutter"
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
}: {
  flag: 'AR' | 'US'
  hidden: boolean
  onToggle(): void
  amount: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Flag country={flag} />
      <div className="min-w-0 flex-1">{amount}</div>
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

function Amount({ testId, text, negative }: { testId: string; text: string; negative: boolean }) {
  const [whole, cents] = splitCents(text)
  return (
    <p
      data-testid={testId}
      className={cx('break-words', text.length > 13 ? 'type-money-sm' : 'type-money', negative ? 'text-danger-on-panel' : 'text-on-panel')}
    >
      {whole}
      {cents ? <span className="type-money-cents">{cents}</span> : null}
    </p>
  )
}

/** Leyenda de la página; la flecha tenue avisa que hay otra página al costado. */
function Caption({ hint, children }: { hint: 'next' | 'prev'; children: React.ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-2 text-body-sm text-on-panel-soft">
      <span className="min-w-0 truncate">{children}</span>
      <Icon name={hint === 'next' ? 'chevron-right' : 'chevron-left'} size="sm" aria-hidden="true" className="shrink-0 opacity-60" />
    </p>
  )
}
