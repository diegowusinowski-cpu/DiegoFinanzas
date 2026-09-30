import type { Category, TransactionType } from './models'

/** Categorías iniciales del sistema (no son datos financieros, son catálogo). */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'cat-income-salary', name: 'Sueldo', type: 'INCOME', system: true },
  { id: 'cat-income-collection', name: 'Cobro', type: 'INCOME', system: true },
  { id: 'cat-income-sale', name: 'Venta', type: 'INCOME', system: true },
  { id: 'cat-income-other', name: 'Otros ingresos', type: 'INCOME', system: true },
  { id: 'cat-expense-food', name: 'Comida', type: 'EXPENSE', system: true },
  { id: 'cat-expense-home', name: 'Hogar', type: 'EXPENSE', system: true },
  { id: 'cat-expense-transport', name: 'Transporte', type: 'EXPENSE', system: true },
  { id: 'cat-expense-services', name: 'Servicios', type: 'EXPENSE', system: true },
  { id: 'cat-expense-health', name: 'Salud', type: 'EXPENSE', system: true },
  { id: 'cat-expense-leisure', name: 'Ocio', type: 'EXPENSE', system: true },
  { id: 'cat-expense-other', name: 'Otros gastos', type: 'EXPENSE', system: true },
]

export function categoriesForType(
  categories: readonly Category[],
  type: TransactionType,
): Category[] {
  return categories.filter((c) => c.type === type)
}

export function findCategory(
  categories: readonly Category[],
  id: string,
): Category | undefined {
  return categories.find((c) => c.id === id)
}
