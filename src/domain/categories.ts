import type { Category, TransactionType } from './models.ts'

/** Categorías vigentes para registrar movimientos (catálogo, no datos financieros). */
const ACTIVE_CATEGORIES: readonly Category[] = [
  { id: 'inc-employment', name: 'Trabajo en relación de dependencia', type: 'INCOME', system: true },
  { id: 'inc-loans', name: 'Préstamos', type: 'INCOME', system: true },
  { id: 'inc-sales', name: 'Ventas ocasionales o emprendimiento', type: 'INCOME', system: true },
  { id: 'inc-scholarship', name: 'Becas de estudio o ayuda estudiantil', type: 'INCOME', system: true },
  { id: 'inc-yield', name: 'Rendimientos de ahorros o billeteras virtuales', type: 'INCOME', system: true },
  { id: 'exp-transport', name: 'Transporte y movilidad', type: 'EXPENSE', system: true },
  { id: 'exp-leisure', name: 'Salidas y ocio', type: 'EXPENSE', system: true },
  { id: 'exp-loans', name: 'Préstamos', type: 'EXPENSE', system: true },
  { id: 'exp-personal', name: 'Cuidado personal y compras', type: 'EXPENSE', system: true },
  { id: 'exp-subscriptions', name: 'Suscripciones y tecnología', type: 'EXPENSE', system: true },
]

/** Categorías de la primera versión: se conservan para que los movimientos viejos sigan mostrando su nombre. */
const RETIRED_CATEGORIES: readonly Category[] = [
  { id: 'cat-income-salary', name: 'Sueldo', type: 'INCOME', system: true, retired: true },
  { id: 'cat-income-collection', name: 'Cobro', type: 'INCOME', system: true, retired: true },
  { id: 'cat-income-sale', name: 'Venta', type: 'INCOME', system: true, retired: true },
  { id: 'cat-income-other', name: 'Otros ingresos', type: 'INCOME', system: true, retired: true },
  { id: 'cat-expense-food', name: 'Comida', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-home', name: 'Hogar', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-transport', name: 'Transporte', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-services', name: 'Servicios', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-health', name: 'Salud', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-leisure', name: 'Ocio', type: 'EXPENSE', system: true, retired: true },
  { id: 'cat-expense-other', name: 'Otros gastos', type: 'EXPENSE', system: true, retired: true },
]

export const DEFAULT_CATEGORIES: readonly Category[] = [...ACTIVE_CATEGORIES, ...RETIRED_CATEGORIES]

/** Categorías que se ofrecen al registrar un movimiento del tipo dado. */
export function categoriesForType(categories: readonly Category[], type: TransactionType): Category[] {
  return categories.filter((c) => c.type === type && !c.retired)
}

export function findCategory(categories: readonly Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}
