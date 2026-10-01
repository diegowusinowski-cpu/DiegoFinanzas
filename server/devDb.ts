import { databaseUrl, neonDb, type Db } from '../api/dwf.ts'
import { pgliteDb } from './pgliteDb.ts'

export const LOCAL_DB_DIR = '.data/pglite'

/**
 * Base de datos para desarrollo, scripts y preview: Neon si hay `DATABASE_URL`; si no, PGlite en
 * disco (`.data/pglite`), o en memoria con `DWF_DB=memory`.
 */
export function openDevDb(env: Record<string, string | undefined>): Promise<Db> {
  const url = databaseUrl(env)
  if (url) return neonDb(url)
  return pgliteDb(env.DWF_DB === 'memory' ? undefined : (env.DWF_DB_DIR ?? LOCAL_DB_DIR))
}
