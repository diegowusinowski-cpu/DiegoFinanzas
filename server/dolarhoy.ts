import { parseAmountToMinor } from '../src/domain/money.ts'

export const DOLARHOY_URL = 'https://dolarhoy.com/'
export const DOLARHOY_SOURCE = { name: 'DolarHoy.com', url: DOLARHOY_URL } as const

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

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&oacute;/gi, 'ó')
}

/** HTML → lista de textos visibles (independiente de la estructura de tags). */
function toTextTokens(html: string): string[] {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '\n')
      .replace(/<[^>]*>/g, '\n'),
  )
    .split('\n')
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t !== '')
}

function parseQuoteValue(token: string | undefined): number | null {
  if (!token) return null
  const cleaned = token.replace(/^\$/, '').trim()
  if (!/^[\d.,]+$/.test(cleaned)) return null
  const minor = parseAmountToMinor(cleaned)
  return minor === null || minor <= 0 ? null : minor / 100
}

function parseUpdatedAt(tokens: string[]): string | null {
  for (const token of tokens) {
    const match = /Actualizad[oa].*?(\d{1,2})\/(\d{1,2})\/(\d{2,4}).*?(\d{1,2}):(\d{2})/i.exec(token)
    if (!match) continue
    const [, d, m, y, hh, mm] = match as unknown as [string, string, string, string, string, string]
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    const pad = (v: string | number) => String(v).padStart(2, '0')
    // DolarHoy publica en hora de Argentina (UTC-3, sin horario de verano).
    const iso = `${year}-${pad(m)}-${pad(d)}T${pad(hh)}:${mm}:00-03:00`
    return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString()
  }
  return null
}

/** Textos que siguen al título, hasta el título de otra cotización (máx. 14). */
function blockAfter(tokens: string[], titleIndex: number): string[] {
  const rest = tokens.slice(titleIndex + 1, titleIndex + 15)
  const next = rest.findIndex((t) => /^d[oó]lar\b/i.test(t))
  return next === -1 ? rest : rest.slice(0, next)
}

/**
 * Extrae compra/venta del Dólar Blue del HTML de DolarHoy.com.
 * Busca el rótulo "Dólar Blue" seguido de "Compra <valor>" y "Venta <valor>";
 * si algo no cuadra lanza `parse_failed` en lugar de devolver valores dudosos.
 */
export function parseDolarHoyBlue(html: string): DolarBlueQuote {
  const tokens = toTextTokens(html)

  for (let i = 0; i < tokens.length; i++) {
    if (!/^d[oó]lar blue$/i.test(tokens[i] ?? '')) continue
    const window = blockAfter(tokens, i)
    const buyIdx = window.findIndex((t) => /^compra$/i.test(t))
    const sellIdx = window.findIndex((t) => /^venta$/i.test(t))
    if (buyIdx === -1 || sellIdx === -1) continue
    const buy = parseQuoteValue(window[buyIdx + 1])
    const sell = parseQuoteValue(window[sellIdx + 1])
    if (buy === null || sell === null) continue
    if (sell < buy || sell / buy > 1.5) continue // sanidad: descarta lecturas absurdas
    return { buy, sell, updatedAt: parseUpdatedAt(tokens.slice(i)) ?? parseUpdatedAt(tokens) }
  }
  throw new DolarHoyError('parse_failed', 'No se encontró la cotización del Dólar Blue en la fuente.')
}

export async function fetchDolarHoyBlue(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8_000,
): Promise<DolarBlueQuote> {
  let html: string
  try {
    const response = await fetchImpl(DOLARHOY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DWF-Finanzas/0.1)',
        Accept: 'text/html',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    html = await response.text()
  } catch (error) {
    throw new DolarHoyError(
      'source_unavailable',
      `No se pudo consultar DolarHoy.com (${error instanceof Error ? error.message : 'error'}).`,
    )
  }
  return parseDolarHoyBlue(html)
}
