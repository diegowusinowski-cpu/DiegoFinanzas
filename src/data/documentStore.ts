/**
 * Almacén de documentos: la capa mínima sobre la que se apoyan TODOS los repositorios. Hay dos
 * implementaciones: la base de datos real (`RemoteDocumentStore`, vía el backend) y un respaldo local
 * en el dispositivo (`LocalDocumentStore`) para cuando no hay servidor (previsualización, sitio estático).
 */
export const COLLECTION_NAMES = {
  transactions: 'transactions',
  accounts: 'accounts',
  categories: 'categories',
  reminders: 'reminders',
  loans: 'loans',
  installments: 'loan-installments',
  savingsJars: 'savings-jars',
  savingsContributions: 'savings-contributions',
  manualBalances: 'manual-balances',
} as const

export type CollectionName = (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

export interface Doc {
  id: string
}

export interface WriteOp {
  collection: CollectionName
  items: readonly Doc[]
}

export interface DocumentStore {
  /** Todos los documentos de la colección, en orden de creación. */
  read<T extends Doc>(collection: CollectionName): Promise<T[]>
  /**
   * Inserta o reemplaza por `id`, en TODAS las colecciones indicadas de una sola vez: o se guardan
   * todos o no se guarda ninguno. No existe el borrado: los datos solo se agregan o se reemplazan.
   */
  apply(ops: readonly WriteOp[]): Promise<void>
}
