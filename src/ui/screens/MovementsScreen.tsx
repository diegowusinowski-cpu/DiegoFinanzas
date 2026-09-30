import { formatRelativeDate } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { EmptyState, Skeleton } from '../components/Card'
import { MovementItem } from '../components/MovementItem'

export function MovementsScreen() {
  const { status, history, categories, today } = useFinance()

  const groups = history.reduce<Array<{ date: string; items: typeof history }>>((acc, t) => {
    const last = acc[acc.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else acc.push({ date: t.date, items: [t] })
    return acc
  }, [])

  return (
    <div className="flex flex-col gap-section px-gutter pb-2 animate-rise">
      <header className="pt-safe">
        <h1 className="type-display">Movimientos</h1>
      </header>
      {status === 'loading' ? (
        <Skeleton className="h-64" />
      ) : groups.length === 0 ? (
        <EmptyState icon="list" title="Todavía no hay movimientos">
          Tus ingresos y gastos se van a listar acá, del más reciente al más antiguo.
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.date} aria-label={formatRelativeDate(group.date, today)} className="flex flex-col gap-1">
            <h2 className="type-eyebrow">{formatRelativeDate(group.date, today)}</h2>
            <ul>
                {group.items.map((t) => (
                  <MovementItem
                    key={t.id}
                    transaction={t}
                    category={categories.find((c) => c.id === t.categoryId)}
                    today={today}
                  />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
