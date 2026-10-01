import type { ApiClient } from './apiClient'
import type { CollectionName, Doc, DocumentStore, WriteOp } from './documentStore'

/**
 * Almacén de documentos respaldado por la base de datos real (PostgreSQL), a través del backend.
 * Cada lectura trae lo guardado en la base y cada escritura es una transacción atómica.
 */
export class RemoteDocumentStore implements DocumentStore {
  constructor(private readonly client: ApiClient) {}

  async read<T extends Doc>(collection: CollectionName): Promise<T[]> {
    const { items } = await this.client.call<{ items: T[] }>('list', { collection })
    return items
  }

  async apply(ops: readonly WriteOp[]): Promise<void> {
    await this.client.call('apply', { ops: ops.map((op) => ({ collection: op.collection, items: op.items })) })
  }
}
