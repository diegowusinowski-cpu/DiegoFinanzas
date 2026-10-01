import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { createDwfHandler, type Db } from '../api/dwf.ts'
import { openDevDb } from './devDb.ts'

const ROUTE = '/api/dwf'
const TEST_RESET_ROUTE = '/api/dwf-test-reset'
/**
 * Expone `/api/dwf` en `vite dev` y `vite preview` con la misma lógica que la función de Vercel
 * (`api/dwf.ts`). Con `DWF_E2E=1` agrega `/api/dwf-test-reset` (vacía la base) solo para las pruebas
 * de navegador; nunca existe en producción.
 */
export function dwfApi(): Plugin {
  let env: Record<string, string | undefined> = process.env
  let db: Promise<Db> | null = null
  const getDb = () => (db ??= openDevDb(env))
  const handler = createDwfHandler({ getDb, env: { ...process.env, NODE_ENV: 'development' } })

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0]
    if (path === ROUTE) {
      void handler(req as never, res as never)
      return
    }
    if (path === TEST_RESET_ROUTE && env.DWF_E2E === '1' && req.method === 'POST') {
      void (async () => {
        const database = await getDb()
        await database.batch([{ text: 'DELETE FROM documents' }, { text: 'DELETE FROM users' }])
        res.statusCode = 200
        res.end('ok')
      })().catch(() => {
        res.statusCode = 200 // todavía no hay schema: no hay nada que vaciar
        res.end('ok')
      })
      return
    }
    next()
  }

  return {
    name: 'dwf-api',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env }
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
