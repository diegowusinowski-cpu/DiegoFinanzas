/** Almacenamiento clave-valor síncrono (localStorage hoy; intercambiable). */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

export interface BrowserStorage {
  storage: KeyValueStorage
  /** `false` si el navegador no permite persistir (modo privado, bloqueado). */
  persistent: boolean
}

export function createBrowserStorage(): BrowserStorage {
  try {
    const probe = '__dwf_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return { storage: window.localStorage, persistent: true }
  } catch {
    return { storage: new MemoryStorage(), persistent: false }
  }
}

export class StorageCorruptedError extends Error {
  constructor(key: string) {
    super(`Los datos guardados en "${key}" están dañados y no se pudieron leer.`)
    this.name = 'StorageCorruptedError'
  }
}
