import type { TransactionType } from '@/domain'
import type { IconName } from '../components/Icon'

const BY_CATEGORY: Record<string, IconName> = {
  'inc-employment': 'work',
  'inc-loans': 'loan',
  'inc-sales': 'store',
  'inc-scholarship': 'scholarship',
  'inc-yield': 'trend',
  'exp-transport': 'transport',
  'exp-leisure': 'leisure',
  'exp-loans': 'loan',
  'exp-personal': 'bag',
  'exp-subscriptions': 'subscription',
  // Categorías de la primera versión
  'cat-income-salary': 'work',
  'cat-income-collection': 'loan',
  'cat-income-sale': 'store',
  'cat-expense-transport': 'transport',
  'cat-expense-leisure': 'leisure',
  'cat-expense-services': 'subscription',
  'cat-expense-food': 'bag',
  'cat-expense-home': 'home',
}

/** Ícono de un movimiento según su categoría real; si no hay uno específico, la flecha de su tipo. */
export function categoryIcon(categoryId: string, type: TransactionType): IconName {
  return BY_CATEGORY[categoryId] ?? (type === 'INCOME' ? 'arrow-down' : 'arrow-up')
}
