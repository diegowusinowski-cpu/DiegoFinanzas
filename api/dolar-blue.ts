/**
 * `GET /api/dolar-blue` — cotización REAL del Dólar Blue leída del lado del servidor desde DolarHoy.com.
 *
 * Este archivo es la función serverless de Vercel y a la vez la única implementación de la lectura:
 * `server/dolarhoy.ts` (dev/preview de Vite y tests) la reexporta. Es autocontenido (sin imports
 * relativos) para que Vercel lo empaquete sin depender de la resolución de módulos del resto del repo.
 *
 * Lectura (misma estructura de DolarHoy que usan otros clientes del sitio):
 *   <div class="title"><a href="/cotizaciondolarblue">Dólar Blue</a></div>
 *   <div class="values">
 *     <div class="compra"><div class="topic">Compra</div><div class="val">$1385</div></div>
 *     <div class="venta"><div class="topic">Venta</div><div class="val">$1405</div></div>
 *   </div>
 *   <div class="update">Actualizado por última vez: 30/09/26 12:05 PM</div>   (hora de Argentina, 12 h)
 * Se consulta la portada y, si falla, la página propia del Dólar Blue (también de DolarHoy.com).
 * Nunca se devuelven valores inventados: si no se puede leer, responde 502.
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

/* ── Consulta a DolarHoy.com ────────────────────────────────────────────── */

const PAGE_TIMEOUT_MS = 4_500

/**
 * Pide las páginas de DolarHoy.com (la portada y luego la del Dólar Blue) hasta obtener una lectura
 * válida. Los dos intentos suman menos que el límite de una función serverless.
 */
export async function fetchDolarHoyBlue(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = PAGE_TIMEOUT_MS,
  pages: readonly string[] = DOLARHOY_PAGES,
): Promise<DolarBlueQuote> {
  let last: DolarHoyError | null = null
  for (const page of pages) {
    try {
      const response = await fetchImpl(page, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-AR,es;q=0.9' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return parseDolarHoyBlue(await response.text())
    } catch (error) {
      last =
        error instanceof DolarHoyError
          ? error
          : new DolarHoyError(
              'source_unavailable',
              `No se pudo consultar DolarHoy.com (${error instanceof Error ? error.message : 'error'}).`,
            )
    }
  }
  throw last ?? new DolarHoyError('source_unavailable', 'No se pudo consultar DolarHoy.com.')
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
    const quote = await fetchDolarHoyBlue()
    // La CDN de Vercel sirve la misma lectura 60 s (y hasta 5 min mientras revalida): no se golpea a
    // dolarhoy.com en cada visita.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ ...quote, fetchedAt: new Date().toISOString(), source: DOLARHOY_SOURCE })
  } catch (error) {
    const code = error instanceof DolarHoyError ? error.code : 'source_unavailable'
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: code, message: 'La cotización no está disponible.' })
  }
}
