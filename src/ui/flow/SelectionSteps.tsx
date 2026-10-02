import { categoriesForType, type AccountHolder, type Category, type Country, type TransactionType } from '@/domain'
import { Flag } from '../components/Flags'
import { Icon } from '../components/Icon'
import { OptionRow } from '../components/OptionRow'
import { COUNTRY_INFO, HOLDER_LABEL, TYPE_LABEL } from './flowModel'
import { LucaMascot, type LucaState } from '../luca'
import { FlowHeader } from './FlowFrame'

interface StepProps {
  onBack(): void
  backLabel: string
  /** Estado de Luca que acompaña el paso (decorativo). */
  luca?: LucaState
}

function SelectionScreen({
  title,
  description,
  children,
  ...header
}: StepProps & { title: string; description?: string; children: React.ReactNode }) {
  return (
    <>
      <FlowHeader
        onBack={header.onBack}
        backLabel={header.backLabel}
        {...(header.luca ? { trailing: <LucaMascot state={header.luca} size="sm" animation="enter" /> } : {})}
      />
      <main className="flex-1 overflow-y-auto px-gutter pt-4 pb-safe">
        <h1 className="type-display">{title}</h1>
        {description ? <p className="mt-2 text-body text-fg-soft">{description}</p> : null}
        <ul className="mt-6">{children}</ul>
      </main>
    </>
  )
}

export function CountryStep({ onSelect, ...nav }: StepProps & { onSelect(country: Country): void }) {
  return (
    <SelectionScreen title="Elegí el país" description="¿En qué país ocurrió el movimiento?" {...nav}>
      {(Object.keys(COUNTRY_INFO) as Country[]).map((country) => (
        <OptionRow
          key={country}
          leading={<Flag country={country} size={36} />}
          title={COUNTRY_INFO[country].name}
          subtitle={COUNTRY_INFO[country].detail}
          onClick={() => onSelect(country)}
        />
      ))}
    </SelectionScreen>
  )
}

export function HolderStep({ onSelect, ...nav }: StepProps & { onSelect(holder: AccountHolder): void }) {
  return (
    <SelectionScreen title="Tipo de cuenta" description="¿A nombre de quién es el movimiento?" {...nav}>
      <OptionRow
        leading={<Icon name="user" />}
        title={HOLDER_LABEL.INDIVIDUAL}
        subtitle="Cuenta personal"
        onClick={() => onSelect('INDIVIDUAL')}
      />
    </SelectionScreen>
  )
}

export function CategoryStep({
  type,
  categories,
  onSelect,
  ...nav
}: StepProps & { type: TransactionType; categories: readonly Category[]; onSelect(category: Category): void }) {
  return (
    <SelectionScreen title={TYPE_LABEL[type].typeQuestion} {...nav}>
      {categoriesForType(categories, type).map((category) => (
        <OptionRow
          key={category.id}
          leading={<Icon name={type === 'INCOME' ? 'arrow-down' : 'arrow-up'} />}
          title={category.name}
          onClick={() => onSelect(category)}
        />
      ))}
    </SelectionScreen>
  )
}
