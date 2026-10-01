import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { DolarHoyError, fetchBlueFromSources, setCors, type SourcedQuote } from './dolarhoy.ts'

const CACHE_TTL_MS = 60_000
const ROUTE = '/api/dolar-blue'

interface CacheEntry {
  result: SourcedQuote
  fetchedAt: string
  expires: number
}

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  setCors(res)
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function createRatesMiddleware(fetchQuote: () => Promise<SourcedQuote> = () => fetchBlueFromSources(), now = Date.now): Middleware {
  let cache: CacheEntry | null = null
  let inflight: Promise<CacheEntry> | null = null

  const load = (): Promise<CacheEntry> => {
    inflight ??= fetchQuote()
      .then((result) => {
        cache = { result, fetchedAt: new Date(now()).toISOString(), expires: now() + CACHE_TTL_MS }
        return cache
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  return (req, res, next) => {
    // Ruta exacta: en `vite dev` el módulo `/api/dolar-blue.ts` (lo importa el navegador) no es esta API.
    const path = req.url?.split('?')[0]
    if (path !== ROUTE && path !== `${ROUTE}/`) return next()
    if (req.method === 'OPTIONS') {
      setCors(res)
      res.statusCode = 204
      return res.end()
    }
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })

    const respond = (entry: CacheEntry) =>
      sendJson(res, 200, { ...entry.result.quote, fetchedAt: entry.fetchedAt, source: entry.result.source })

    if (cache && cache.expires > now()) return respond(cache)
    load().then(respond, (error: unknown) => {
      const code = error instanceof DolarHoyError ? error.code : 'source_unavailable'
      sendJson(res, 502, { error: code, message: 'La cotización no está disponible.' })
    })
  }
}

/** Expone `/api/dolar-blue` en `vite dev` y `vite preview`. */
export function dwfRatesApi(): Plugin {
  return {
    name: 'dwf-rates-api',
    configureServer(server) {
      server.middlewares.use(createRatesMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createRatesMiddleware())
    },
  }
}
