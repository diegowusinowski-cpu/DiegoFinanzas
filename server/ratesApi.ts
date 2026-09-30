import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { DOLARHOY_SOURCE, DolarHoyError, fetchDolarHoyBlue, type DolarBlueQuote } from './dolarhoy.ts'

const CACHE_TTL_MS = 60_000
const ROUTE = '/api/dolar-blue'

interface CacheEntry {
  quote: DolarBlueQuote
  fetchedAt: string
  expires: number
}

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function createRatesMiddleware(fetchQuote = fetchDolarHoyBlue, now = Date.now): Middleware {
  let cache: CacheEntry | null = null
  let inflight: Promise<CacheEntry> | null = null

  const load = (): Promise<CacheEntry> => {
    inflight ??= fetchQuote()
      .then((quote) => {
        cache = { quote, fetchedAt: new Date(now()).toISOString(), expires: now() + CACHE_TTL_MS }
        return cache
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  return (req, res, next) => {
    if (!req.url?.split('?')[0]?.startsWith(ROUTE)) return next()
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })

    const respond = (entry: CacheEntry) =>
      sendJson(res, 200, { ...entry.quote, fetchedAt: entry.fetchedAt, source: DOLARHOY_SOURCE })

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
