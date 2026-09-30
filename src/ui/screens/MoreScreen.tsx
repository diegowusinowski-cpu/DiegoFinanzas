import { maskPhone } from '@/services/auth'
import { useAuth } from '@/state/AuthContext'
import { BrandFooter } from '../components/Brand'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'

const UPCOMING = ['Préstamos y cuotas', 'Cobros pendientes', 'Sueldo y adelantos', 'Movimientos recurrentes']

export function MoreScreen() {
  const { profile, lock } = useAuth()
  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header className="pt-safe">
        <h1 className="text-3xl font-extrabold tracking-tight">Más</h1>
      </header>

      {profile ? (
        <Card className="flex items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-full bg-ink text-lg font-bold text-white">
            {profile.displayName.charAt(0)}
          </span>
          <div>
            <p className="text-base font-bold">{profile.displayName}</p>
            <p className="text-sm text-muted">{maskPhone(profile.phone)}</p>
          </div>
        </Card>
      ) : null}

      <Button variant="secondary" block onClick={lock}>
        <Icon name="lock" size={18} />
        Bloquear DWF
      </Button>

      <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
        <h2 id="upcoming-title" className="text-lg font-bold tracking-tight">
          Próximamente
        </h2>
        <Card className="px-5 py-1.5">
          <ul className="divide-y divide-line">
            {UPCOMING.map((label) => (
              <li key={label} className="flex items-center justify-between py-3.5 text-[0.95rem] font-medium text-ink-soft">
                {label}
                <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold text-muted">En camino</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <BrandFooter />
    </div>
  )
}
