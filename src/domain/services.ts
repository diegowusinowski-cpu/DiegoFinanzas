import { normalizeText } from './movementsView'
import type { Category, MinorUnits, Transaction } from './models'
import { sortByRecency } from './transactions'

/** Servicios y suscripciones conocidos: nombre a mostrar y palabras con las que aparecen en un concepto. */
const KNOWN_SERVICES: ReadonlyArray<{ name: string; keywords: readonly string[]; icon: ServiceIcon }> = [
  { name: 'SUBE', keywords: ['sube'], icon: 'transport' },
  { name: 'Uber', keywords: ['uber'], icon: 'transport' },
  { name: 'Cabify', keywords: ['cabify'], icon: 'transport' },
  { name: 'Mercado Libre', keywords: ['mercado libre', 'mercadolibre', 'meli'], icon: 'bag' },
  { name: 'Mercado Pago', keywords: ['mercado pago', 'mercadopago'], icon: 'bag' },
  { name: 'PedidosYa', keywords: ['pedidosya', 'pedidos ya'], icon: 'bag' },
  { name: 'Rappi', keywords: ['rappi'], icon: 'bag' },
  { name: 'Claro', keywords: ['claro'], icon: 'subscription' },
  { name: 'Movistar', keywords: ['movistar'], icon: 'subscription' },
  { name: 'Telecentro', keywords: ['telecentro'], icon: 'subscription' },
  { name: 'Fibertel', keywords: ['fibertel'], icon: 'subscription' },
  { name: 'Flow', keywords: ['flow'], icon: 'subscription' },
  { name: 'Netflix', keywords: ['netflix'], icon: 'subscription' },
  { name: 'Spotify', keywords: ['spotify'], icon: 'subscription' },
  { name: 'Disney+', keywords: ['disney'], icon: 'subscription' },
  { name: 'HBO Max', keywords: ['hbo'], icon: 'subscription' },
  { name: 'YouTube', keywords: ['youtube'], icon: 'subscription' },
  { name: 'Amazon Prime', keywords: ['amazon prime', 'prime video'], icon: 'subscription' },
  { name: 'iCloud', keywords: ['icloud'], icon: 'subscription' },
  { name: 'Google One', keywords: ['google one'], icon: 'subscription' },
  { name: 'Edenor', keywords: ['edenor'], icon: 'subscription' },
  { name: 'Edesur', keywords: ['edesur'], icon: 'subscription' },
  { name: 'Metrogas', keywords: ['metrogas'], icon: 'subscription' },
  { name: 'AySA', keywords: ['aysa'], icon: 'subscription' },
]

/** Categorías que por sí mismas indican un servicio o suscripción (incluye la de la primera versión). */
const SERVICE_CATEGORY_IDS: ReadonlySet<string> = new Set(['exp-subscriptions', 'cat-expense-services'])

export type ServiceIcon = 'transport' | 'bag' | 'subscription'

export interface DetectedService {
  transaction: Transaction
  /** Nombre del servicio: el comercio reconocido o, si no, el concepto del gasto. */
  name: string
  /** Ícono propio del servicio; `null` si no es una marca conocida (se usa el de su categoría). */
  icon: ServiceIcon | null
}

function mentions(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/ /g, '\\s+')}($|[^a-z0-9])`).test(text)
}

/**
 * Un gasto es de un servicio si su concepto nombra un comercio conocido (SUBE, Mercado Libre, Claro,
 * Uber, Netflix, Spotify…) o si está en la categoría de suscripciones/servicios. Ni los ingresos, ni los
 * gastos anulados, ni los préstamos cuentan.
 */
export function detectService(transaction: Transaction, categories: readonly Category[] = []): DetectedService | null {
  if (transaction.type !== 'EXPENSE' || transaction.status !== 'COMPLETED' || transaction.loanId !== null) return null
  const text = normalizeText(transaction.description)
  const known = KNOWN_SERVICES.find((s) => s.keywords.some((k) => mentions(text, k)))
  if (known) return { transaction, name: known.name, icon: known.icon }
  const category = categories.find((c) => c.id === transaction.categoryId)
  const byCategory = SERVICE_CATEGORY_IDS.has(transaction.categoryId) || category?.id === 'exp-subscriptions'
  return byCategory ? { transaction, name: transaction.description, icon: null } : null
}

/** Los últimos `limit` gastos de servicios, del más reciente al más antiguo. Usa los movimientos reales. */
export function latestServices(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  limit: number,
): DetectedService[] {
  const found: DetectedService[] = []
  for (const t of sortByRecency(transactions)) {
    const service = detectService(t, categories)
    if (service) found.push(service)
    if (found.length === limit) break
  }
  return found
}

/** Pesos → dólares con la cotización indicada (pesos por dólar). Sin cotización válida no hay conversión. */
export function convertArsToUsd(arsMinor: MinorUnits, pesosPerDollar: number): MinorUnits | null {
  if (!Number.isFinite(pesosPerDollar) || pesosPerDollar <= 0) return null
  return Math.round(arsMinor / pesosPerDollar)
}
