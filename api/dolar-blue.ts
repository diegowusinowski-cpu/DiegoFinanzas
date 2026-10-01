/**
 * `GET /api/dolar-blue` — cotización REAL del Dólar Blue, leída del lado del servidor.
 *
 * Fuentes, en orden (si una falla o devuelve algo ilegible, se prueba la siguiente):
 *   1. DolarHoy.com (portada y página /cotizaciondolarblue, leyendo el HTML)
 *   2. DolarAPI.com (API pública de JSON que consulta DolarHoy)
 *   3. Bluelytics (API pública de JSON, independiente)
 * El navegador usa las mismas fuentes 2 y 3 de forma directa cuando no hay servidor (ver
 * `src/services/liveRateProvider.ts`), así que la cotización funciona también en un hosting estático.
 *
 * Este archivo es la función serverless de Vercel y a la vez la única implementación de la lectura:
 * `server/dolarhoy.ts` (dev/preview de Vite y tests) y el navegador la reutilizan. Es autocontenido
 * (sin imports relativos) para que Vercel lo empaquete sin depender de la resolución de módulos.
 *
 * Estructura de DolarHoy que se lee:
 *   <div class="title"><a href="/cotizaciondolarblue">Dólar Blue</a></div>
 *   <div class="values">
 *     <div class="compra"><div class="topic">Compra</div><div class="val">$1385</div></div>
 *     <div class="venta"><div class="topic">Venta</div><div class="val">$1405</div></div>
 *   </div>
 *   <div class="update">Actualizado por última vez: 30/09/26 12:05 PM</div>   (hora de Argentina, 12 h)
 * Nunca se devuelven valores inventados: si ninguna fuente responde, el servidor contesta 502.
 */

export const DOLARHOY_URL = 'https://dolarhoy.com/'
export const DOLARHOY_BLUE_PATH = '/cotizaciondolarblue'
export const DOLARHOY_SOURCE = { name: 'DolarHoy.com', url: DOLARHOY_URL } as const
/** Páginas de DolarHoy.com que contienen el bloque del Dólar Blue, en orden de preferencia. */
export const DOLARHOY_PAGES = [DOLARHOY_URL, `https://dolarhoy.com${DOLARHOY_BLUE_PATH}`] as const

export interface DolarBlueQuote {
  buy: number
  sell: number
  /** ISO 8601, o `null` si la fuente no informa una fecha interpretable. */
  updatedAt: string | null
}

export class DolarHoyError extends Error {
  constructor(
    readonly code: 'source_unavailable' | 'parse_failed',
    message: string,
  ) {
    super(message)
    this.name = 'DolarHoyError'
  }
}

/* ── Parseo ─────────────────────────────────────────────────────────────── */

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
}

/** HTML → lista de textos visibles (independiente de la estructura de tags). */
function toTextTokens(html: string): string[] {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '\n').replace(/<[^>]*>/g, '\n'))
    .split('\n')
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t !== '')
}

/** `$1385`, `$1.385`, `1.405,50`, `1385,5` → número. `null` si no es un importe. */
export function parseQuoteValue(raw: string | undefined): number | null {
  if (!raw) return null
  const text = decodeEntities(raw).replace(/\$/g, '').replace(/\s+/g, '')
  if (!/^[\d.,]+$/.test(text)) return null
  let normalized: string
  if (text.includes(',')) normalized = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, '')
  else normalized = text
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

const pad = (v: string | number) => String(v).padStart(2, '0')

/**
 * `Actualizado por última vez: 30/09/26 12:05 PM` (o 24 h) → ISO. DolarHoy publica en hora de
 * Argentina (UTC-3, sin horario de verano) y en formato de 12 horas con AM/PM.
 */
function parseUpdatedAt(tokens: string[]): string | null {
  for (const token of tokens) {
    const match =
      /Actualizad[oa].*?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\D{0,12}?(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:([ap])\.?\s?m\.?)?/i.exec(token)
    if (!match) continue
    const [, d, m, y, hh, mm, meridiem] = match as unknown as [string, string, string, string, string, string, string | undefined]
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    let hour = Number(hh)
    if (meridiem) {
      const pm = meridiem.toLowerCase() === 'p'
      if (hour === 12) hour = pm ? 12 : 0
      else if (pm) hour += 12
    }
    if (hour > 23) continue
    const iso = `${year}-${pad(m)}-${pad(d)}T${pad(hour)}:${mm}:00-03:00`
    return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString()
  }
  return null
}

function sane(buy: number | null, sell: number | null): { buy: number; sell: number } | null {
  if (buy === null || sell === null) return null
  if (sell < buy || sell / buy > 1.5) return null // descarta lecturas absurdas
  return { buy, sell }
}

/** Lectura por estructura: el enlace del Dólar Blue seguido de su bloque `values` (compra/venta). */
function parseByStructure(html: string): { buy: number; sell: number } | null {
  const anchor = /<a\b[^>]*href=["']\/cotizaciondolarblue\/?["'][^>]*>[\s\S]*?<\/a>/gi
  for (let hit = anchor.exec(html); hit; hit = anchor.exec(html)) {
    const after = html.slice(hit.index + hit[0].length, hit.index + hit[0].length + 2500)
    // Solo etiquetas de cierre/apertura de contenedores entre el título y su bloque de valores.
    const head = /^\s*(?:<\/?(?:div|span|h\d|p)\b[^>]*>\s*)*?<div\b[^>]*class=["'][^"']*\bvalues\b[^"']*["'][^>]*>/i.exec(after)
    if (!head) continue
    const block = after.slice(head[0].length)
    const buy = /class=["'][^"']*\bcompra\b[^"']*["'][\s\S]*?class=["'][^"']*\bval\b[^"']*["'][^>]*>([\s\S]*?)</i.exec(block)
    const sell = /class=["'][^"']*\bventa\b[^"']*["'][\s\S]*?class=["'][^"']*\bval\b[^"']*["'][^>]*>([\s\S]*?)</i.exec(block)
    const values = sane(parseQuoteValue(buy?.[1]), parseQuoteValue(sell?.[1]))
    if (values) return values
  }
  return null
}

/** Respaldo ante cambios de clases: rótulo "Dólar Blue" seguido de "Compra <valor>" y "Venta <valor>". */
function parseByText(tokens: string[]): { buy: number; sell: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (!/^d[oó]lar blue$/i.test(tokens[i] ?? '')) continue
    const rest = tokens.slice(i + 1, i + 15)
    const next = rest.findIndex((t) => /^d[oó]lar\b/i.test(t))
    const window = next === -1 ? rest : rest.slice(0, next)
    const buyIdx = window.findIndex((t) => /^compra$/i.test(t))
    const sellIdx = window.findIndex((t) => /^venta$/i.test(t))
    if (buyIdx === -1 || sellIdx === -1) continue
    const values = sane(parseQuoteValue(window[buyIdx + 1]), parseQuoteValue(window[sellIdx + 1]))
    if (values) return values
  }
  return null
}

/**
 * Extrae compra/venta/actualización del Dólar Blue del HTML de DolarHoy.com.
 * Si algo no cuadra lanza `parse_failed` en lugar de devolver valores dudosos.
 */
export function parseDolarHoyBlue(html: string): DolarBlueQuote {
  const tokens = toTextTokens(html)
  const values = parseByStructure(html) ?? parseByText(tokens)
  if (!values) throw new DolarHoyError('parse_failed', 'No se encontró la cotización del Dólar Blue en la fuente.')
  return { ...values, updatedAt: parseUpdatedAt(tokens) }
}

/* ── Otras fuentes públicas (JSON) ─────────────────────────────────────── */

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** DolarAPI: `{ compra, venta, fechaActualizacion }`. */
export function parseDolarApi(body: string): DolarBlueQuote {
  const data = JSON.parse(body) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown }
  const values = sane(toNumber(data.compra), toNumber(data.venta))
  if (!values) throw new DolarHoyError('parse_failed', 'DolarAPI no devolvió una cotización válida.')
  return { ...values, updatedAt: isoOrNull(data.fechaActualizacion) }
}

/** Bluelytics: `{ blue: { value_buy, value_sell }, last_update }`. */
export function parseBluelytics(body: string): DolarBlueQuote {
  const data = JSON.parse(body) as { blue?: { value_buy?: unknown; value_sell?: unknown }; last_update?: unknown }
  const values = sane(toNumber(data.blue?.value_buy), toNumber(data.blue?.value_sell))
  if (!values) throw new DolarHoyError('parse_failed', 'Bluelytics no devolvió una cotización válida.')
  return { ...values, updatedAt: isoOrNull(data.last_update) }
}

/* ── Fuentes y consulta con respaldo ────────────────────────────────────── */

export interface RateSource {
  id: 'dolarhoy' | 'dolarapi' | 'bluelytics'
  name: string
  url: string
  /** Direcciones a consultar, en orden. */
  endpoints: readonly string[]
  /** Convierte la respuesta cruda en cotización (lanza si no es legible). */
  read(body: string): DolarBlueQuote
}

export const DOLARHOY_RATE_SOURCE: RateSource = {
  id: 'dolarhoy',
  name: DOLARHOY_SOURCE.name,
  url: DOLARHOY_URL,
  endpoints: DOLARHOY_PAGES,
  read: parseDolarHoyBlue,
}
export const DOLARAPI_RATE_SOURCE: RateSource = {
  id: 'dolarapi',
  name: 'DolarAPI.com',
  url: 'https://dolarapi.com/',
  endpoints: ['https://dolarapi.com/v1/dolares/blue'],
  read: parseDolarApi,
}
export const BLUELYTICS_RATE_SOURCE: RateSource = {
  id: 'bluelytics',
  name: 'Bluelytics',
  url: 'https://bluelytics.com.ar/',
  endpoints: ['https://api.bluelytics.com.ar/v2/latest'],
  read: parseBluelytics,
}

/** Servidor: DolarHoy primero y las APIs públicas como respaldo. */
export const SERVER_RATE_SOURCES: readonly RateSource[] = [DOLARHOY_RATE_SOURCE, DOLARAPI_RATE_SOURCE, BLUELYTICS_RATE_SOURCE]
/** Navegador sin servidor: DolarHoy no se puede leer directo (CORS), así que solo las APIs públicas. */
export const BROWSER_RATE_SOURCES: readonly RateSource[] = [DOLARAPI_RATE_SOURCE, BLUELYTICS_RATE_SOURCE]

/** Una cotización con fecha más vieja que esto no se considera "actual" mientras otra fuente pueda mejorarla. */
export const MAX_QUOTE_AGE_MS = 72 * 3_600_000
const SOURCE_TIMEOUT_MS = 3_000

export interface SourcedQuote {
  quote: DolarBlueQuote
  source: { name: string; url: string }
}

interface FetchOptions {
  sources?: readonly RateSource[]
  fetchImpl?: typeof fetch
  timeoutMs?: number
  signal?: AbortSignal | undefined
  now?: () => number
}

async function request(fetchImpl: typeof fetch, url: string, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json,text/html;q=0.9', 'Accept-Language': 'es-AR,es;q=0.9' },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Consulta las fuentes en orden hasta obtener una cotización válida y actual. Si una fuente responde
 * con un dato demasiado viejo se sigue con la siguiente; si ninguna tiene uno más reciente se devuelve
 * el más nuevo encontrado (con su fecha real). Nunca inventa valores: si nada sirve, lanza el último error.
 */
export async function fetchBlueFromSources(options: FetchOptions = {}): Promise<SourcedQuote> {
  const { sources = SERVER_RATE_SOURCES, fetchImpl = fetch, timeoutMs = SOURCE_TIMEOUT_MS, signal, now = Date.now } = options
  let newestOld: (SourcedQuote & { time: number }) | null = null
  let last: DolarHoyError | null = null

  for (const source of sources) {
    for (const endpoint of source.endpoints) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        const quote = source.read(await request(fetchImpl, endpoint, timeoutMs, signal))
        const result = { quote, source: { name: source.name, url: source.url } }
        const time = quote.updatedAt === null ? null : Date.parse(quote.updatedAt)
        if (time === null || now() - time <= MAX_QUOTE_AGE_MS) return result
        if (!newestOld || time > newestOld.time) newestOld = { ...result, time }
      } catch (error) {
        if (signal?.aborted) throw error
        last =
          error instanceof DolarHoyError
            ? error
            : error instanceof SyntaxError
              ? new DolarHoyError('parse_failed', `${source.name} devolvió una respuesta ilegible.`)
              : new DolarHoyError(
                  'source_unavailable',
                  `No se pudo consultar ${source.name} (${error instanceof Error ? error.message : 'error'}).`,
                )
      }
    }
  }
  if (newestOld) return { quote: newestOld.quote, source: newestOld.source }
  throw last ?? new DolarHoyError('source_unavailable', 'No hay fuentes disponibles.')
}

/** Solo DolarHoy.com (sus páginas, en orden). */
export async function fetchDolarHoyBlue(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = SOURCE_TIMEOUT_MS,
  pages: readonly string[] = DOLARHOY_PAGES,
): Promise<DolarBlueQuote> {
  const { quote } = await fetchBlueFromSources({
    sources: [{ ...DOLARHOY_RATE_SOURCE, endpoints: pages }],
    fetchImpl,
    timeoutMs,
  })
  return quote
}

/* ── Función serverless (Vercel) ────────────────────────────────────────── */

interface Req {
  method?: string
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
  end(body?: string): void
}

/** Cabeceras comunes: la cotización es pública, así que se permite leerla desde cualquier origen (CORS). */
export function setCors(res: Pick<Res, 'setHeader'>): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type')
}

export default async function handler(req: Req, res: Res): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  try {
    const { quote, source } = await fetchBlueFromSources()
    // La CDN de Vercel sirve la misma lectura 60 s (y hasta 5 min mientras revalida): no se golpea a
    // las fuentes en cada visita.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ ...quote, fetchedAt: new Date().toISOString(), source })
  } catch (error) {
    const code = error instanceof DolarHoyError ? error.code : 'source_unavailable'
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: code, message: 'La cotización no está disponible.' })
  }
}
