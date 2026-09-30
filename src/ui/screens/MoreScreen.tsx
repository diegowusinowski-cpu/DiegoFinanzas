import { maskPhone } from '@/services/auth'
import { useAuth } from '@/state/AuthContext'
import { BrandFooter } from '../components/Brand'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { SectionHeader } from '../components/SectionHeader'

const UPCOMING = ['Préstamos y cuotas', 'Cobros pendientes', 'Sueldo y adelantos', 'Movimientos recurrentes']

export function MoreScreen() {
  const { profile, lock } = useAuth()
  return (
    <div className="flex flex-col gap-section px-gutter pb-2 animate-rise">
      <header className="pt-safe">
        <h1 className="type-display">Más</h1>
      </header>

      {profile ? (
        <div className="flex items-center gap-3">
          <span className="grid size-control-md place-items-center rounded-pill bg-action text-title font-medium text-on-action">
            {profile.displayName.charAt(0)}
          </span>
          <div>
            <p className="type-subheading text-fg">{profile.displayName}</p>
            <p className="text-body-sm text-fg-soft">{maskPhone(profile.phone)}</p>
          </div>
        </div>
      ) : null}

      <Button variant="secondary" block onClick={lock}>
        <Icon name="lock" size="sm" />
        Bloquear DWF
      </Button>

      <section aria-labelledby="upcoming-title" className="flex flex-col gap-block">
        <SectionHeader id="upcoming-title" title="Próximamente" />
        <ul className="divide-y divide-line">
          {UPCOMING.map((label) => (
            <li key={label} className="flex items-center justify-between py-3 text-body text-fg">
              {label}
              <span className="rounded-chip bg-sunken px-2 py-1 text-caption leading-none font-medium text-fg-soft">
                En camino
              </span>
            </li>
          ))}
        </ul>
      </section>

      <BrandFooter />
    </div>
  )
}
