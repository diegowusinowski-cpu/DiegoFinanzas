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
    <div className="flex flex-col gap-8 animate-rise">
      <header className="pt-safe">
        <h1 className="type-display">Más</h1>
      </header>

      {profile ? (
        <Card className="flex items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-pill bg-pale-iris font-display text-title font-light text-void">
            {profile.displayName.charAt(0)}
          </span>
          <div>
            <p className="text-body font-medium text-fg">{profile.displayName}</p>
            <p className="text-body-sm text-fg-soft">{maskPhone(profile.phone)}</p>
          </div>
        </Card>
      ) : null}

      <Button variant="secondary" block onClick={lock}>
        <Icon name="lock" size={18} />
        Bloquear DWF
      </Button>

      <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
        <h2 id="upcoming-title" className="type-heading">
          Próximamente
        </h2>
        <Card className="px-5 py-1">
          <ul className="divide-y divide-line">
            {UPCOMING.map((label) => (
              <li key={label} className="flex items-center justify-between py-4 text-body text-fg-heading">
                {label}
                <span className="rounded-pill border border-line bg-glass px-2.5 py-1 font-mono text-[0.625rem] leading-none tracking-[0.12em] text-fg-soft uppercase">En camino</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <BrandFooter />
    </div>
  )
}
