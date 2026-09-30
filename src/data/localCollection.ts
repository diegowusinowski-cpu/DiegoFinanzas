import { StorageCorruptedError, type KeyValueStorage } from './storage'

interface Envelope<T> {
  version: number
  items: T[]
}

/**
 * Colección persistida como JSON versionado en un `KeyValueStorage`.
 * La versión permite migrar el formato cuando se pase a una base real.
 */
export class LocalCollection<T extends { id: string }> {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
    private readonly version = 1,
  ) {}

  read(): T[] {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return []
    try {
      const parsed = JSON.parse(raw) as Envelope<T>
      if (!parsed || !Array.isArray(parsed.items) || typeof parsed.version !== 'number') {
        throw new Error('formato inesperado')
      }
      return parsed.items
    } catch {
      // Nunca sobrescribimos datos que no entendemos: se informa el error.
      throw new StorageCorruptedError(this.key)
    }
  }

  write(items: readonly T[]): void {
    const envelope: Envelope<T> = { version: this.version, items: [...items] }
    this.storage.setItem(this.key, JSON.stringify(envelope))
  }

  /** Inserta o reemplaza por `id` (una sola escritura). */
  upsertMany(incoming: readonly T[]): void {
    const byId = new Map(this.read().map((item) => [item.id, item]))
    for (const item of incoming) byId.set(item.id, item)
    this.write([...byId.values()])
  }
}
