import { mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { Db, Row } from '../api/dwf.ts'

/**
 * PostgreSQL embebido (PGlite) para desarrollo local y pruebas: el mismo SQL que en producción, sin
 * instalar ni configurar nada. Con `dataDir` los datos quedan en disco; sin él, en memoria.
 */
export async function pgliteDb(dataDir?: string): Promise<Db & { close(): Promise<void> }> {
  if (dataDir) mkdirSync(dataDir, { recursive: true })
  const pg = dataDir ? new PGlite(dataDir) : new PGlite()
  await pg.waitReady
  return {
    query: async (text, params) => (await pg.query(text, params ?? [])).rows as Row[],
    batch: async (statements) => {
      await pg.transaction(async (tx) => {
        for (const statement of statements) await tx.query(statement.text, statement.params ?? [])
      })
    },
    close: () => pg.close(),
  }
}
