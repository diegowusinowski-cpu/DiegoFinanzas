import type { LoanView, MinorUnits, TransactionType } from '@/domain'
import type { LucaState } from './poses'

/**
 * Qué estado de Luca corresponde en cada situación. Son funciones puras: las pantallas solo eligen el
 * contexto y el estado sale de acá (así todo el personaje se comporta igual en toda la app).
 */

/** Inicio: contenta si hay saldo, pensativa si está en negativo (sin dramatismo), tranquila en cero. */
export function homeLuca(balance: MinorUnits): LucaState {
  if (balance > 0) return 'happy'
  if (balance < 0) return 'thinking'
  return 'default'
}

/** Recordatorios: atenta si hay alguno pendiente; sin recordatorios no aparece (`null`). */
export function remindersLuca(pendingCount: number): LucaState | null {
  return pendingCount > 0 ? 'attentive' : null
}

/** Mientras se carga un movimiento: tranquila en un ingreso, pensativa en un gasto. */
export function flowLuca(type: TransactionType): LucaState {
  return type === 'INCOME' ? 'default' : 'thinking'
}

/** Movimiento confirmado: celebra un ingreso; en un gasto queda tranquila, sin culpa. */
export function confirmedLuca(type: TransactionType): LucaState {
  return type === 'INCOME' ? 'celebrating' : 'success'
}

/** Préstamo: pensativa con cuotas pendientes o vencidas, contenta si ya está completo. */
export function loanLuca(view: LoanView): LucaState {
  return view === 'COMPLETED' ? 'happy' : 'thinking'
}

/** Frasco de ahorro: celebra la meta cumplida; mientras tanto acompaña con la alcancía. */
export function jarLuca(completed: boolean): LucaState {
  return completed ? 'goal' : 'saving'
}
