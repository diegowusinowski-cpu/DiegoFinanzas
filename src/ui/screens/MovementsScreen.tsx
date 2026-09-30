import { formatRelativeDate } from '@/domain'
import { useFinance } from '@/state/FinanceContext'
import { Card, EmptyState, Skeleton } from '../components/Card'
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
    <div className="flex flex-col gap-5 animate-rise">
      <header className="pt-safe">
        <h1 className="text-3xl font-extrabold tracking-tight">Movimientos</h1>
      </header>
      {status === 'loading' ? (
        <Skeleton className="h-64 rounded-card" />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon="list" title="Todavía no hay movimientos">
            Tus ingresos y gastos se van a listar acá, del más reciente al más antiguo.
          </EmptyState>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.date} aria-label={formatRelativeDate(group.date, today)} className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold text-muted">{formatRelativeDate(group.date, today)}</h2>
            <Card className="px-5 py-1.5">
              <ul className="divide-y divide-line">
                {group.items.map((t) => (
                  <MovementItem
                    key={t.id}
                    transaction={t}
                    category={categories.find((c) => c.id === t.categoryId)}
                    today={today}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  )
}
