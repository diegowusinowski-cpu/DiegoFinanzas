import {
  formatDayMonthTitleCase,
  type AccountHolder,
  type Country,
  type CurrencyCode,
  type LocalDate,
  type PaymentMethod,
  type TransactionType,
} from '@/domain'

export type FlowStep = 'country' | 'holder' | 'category' | 'amount' | 'confirm' | 'done'

/** Todo lo que el flujo recuerda de principio a fin. */
export interface FlowData {
  type: TransactionType
  country: Country
  holder: AccountHolder
  categoryId: string
  /** Texto crudo del teclado (`"10000,5"`). */
  amountRaw: string
  concept: string
  paymentMethod: PaymentMethod
  date: LocalDate
}

export const COUNTRY_INFO: Record<Country, { name: string; currency: CurrencyCode; detail: string }> = {
  AR: { name: 'Argentina', currency: 'ARS', detail: 'Pesos argentinos · ARS' },
  US: { name: 'Estados Unidos', currency: 'USD', detail: 'Dólares estadounidenses · USD' },
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
}

export const HOLDER_LABEL: Record<AccountHolder, string> = { INDIVIDUAL: 'Individual' }

export const TYPE_LABEL: Record<TransactionType, { noun: string; typeQuestion: string; confirmRow: string; confirmCta: string }> = {
  INCOME: { noun: 'Ingreso', typeQuestion: 'Tipo de ingreso', confirmRow: 'Ingresado', confirmCta: 'Confirmar ingreso' },
  EXPENSE: { noun: 'Gasto', typeQuestion: 'Tipo de gasto', confirmRow: 'Gasto', confirmCta: 'Confirmar gasto' },
}

const ORDER: FlowStep[] = ['country', 'holder', 'category', 'amount', 'confirm']

export function previousStep(step: FlowStep): FlowStep | null {
  const i = ORDER.indexOf(step)
  return i > 0 ? (ORDER[i - 1] ?? null) : null
}

/** `2026-10-02` → `2 de Octubre del 2026` */
export function formatLongDate(date: LocalDate): string {
  return `${formatDayMonthTitleCase(date)} del ${date.slice(0, 4)}`
}
