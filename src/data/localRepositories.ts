import { COLLECTION_NAMES, type CollectionName, type Doc, type DocumentStore, type WriteOp } from './documentStore'
import { createRepositories, DEFAULT_ACCOUNT_ID } from './documentRepositories'
import { LocalCollection } from './localCollection'
import type { Repositories } from './repositories'
import type { KeyValueStorage } from './storage'

export { DEFAULT_ACCOUNT_ID }

const PREFIX = 'dwf.v1.'

/** Claves del respaldo local, una por colección (`dwf.v1.<colección>`). */
export const STORAGE_KEYS = {
  transactions: `${PREFIX}${COLLECTION_NAMES.transactions}`,
  accounts: `${PREFIX}${COLLECTION_NAMES.accounts}`,
  categories: `${PREFIX}${COLLECTION_NAMES.categories}`,
  reminders: `${PREFIX}${COLLECTION_NAMES.reminders}`,
  loans: `${PREFIX}${COLLECTION_NAMES.loans}`,
  installments: `${PREFIX}${COLLECTION_NAMES.installments}`,
  savingsJars: `${PREFIX}${COLLECTION_NAMES.savingsJars}`,
  savingsContributions: `${PREFIX}${COLLECTION_NAMES.savingsContributions}`,
  manualBalances: `${PREFIX}${COLLECTION_NAMES.manualBalances}`,
} as const

/**
 * Respaldo local en el dispositivo (localStorage). Solo se usa cuando no hay servidor ni base de datos
 * (por ejemplo la previsualización o un sitio estático); con backend, la fuente de verdad es la base.
 */
export class LocalDocumentStore implements DocumentStore {
  constructor(private readonly storage: KeyValueStorage) {}

  private collection<T extends Doc>(name: CollectionName) {
    return new LocalCollection<T>(this.storage, `${PREFIX}${name}`)
  }

  async read<T extends Doc>(collection: CollectionName): Promise<T[]> {
    return this.collection<T>(collection).read()
  }

  async apply(ops: readonly WriteOp[]): Promise<void> {
    const keys = [...new Set(ops.map((op) => `${PREFIX}${op.collection}`))]
    const snapshot = keys.map((key) => [key, this.storage.getItem(key)] as const)
    try {
      for (const op of ops) this.collection(op.collection).upsertMany(op.items)
    } catch (error) {
      // Todo o nada: si algo falla se restauran las colecciones tocadas. Cada una se restaura por
      // separado: que una falle no impide restaurar las demás.
      for (const [key, raw] of snapshot) {
        try {
          if (raw === null) this.storage.removeItem(key)
          else this.storage.setItem(key, raw)
        } catch {
          continue
        }
      }
      throw error
    }
  }
}

export function createLocalRepositories(storage: KeyValueStorage): Repositories {
  return createRepositories(new LocalDocumentStore(storage))
}
