import type { TransactionStatus } from '@/domain'

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  COMPLETED: 'Completado',
  SCHEDULED: 'Programado',
  CANCELLED: 'Anulado',
}
