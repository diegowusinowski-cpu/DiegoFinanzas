// Función serverless (Vercel) equivalente a server/ratesApi.ts para producción.
import { DOLARHOY_SOURCE, DolarHoyError, fetchDolarHoyBlue } from '../server/dolarhoy.ts'

interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default async function handler(_req: unknown, res: Res): Promise<void> {
  try {
    const quote = await fetchDolarHoyBlue()
    // La CDN cachea 60 s: evita golpear a dolarhoy.com en cada visita.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
    res.status(200).json({ ...quote, fetchedAt: new Date().toISOString(), source: DOLARHOY_SOURCE })
  } catch (error) {
    const code = error instanceof DolarHoyError ? error.code : 'source_unavailable'
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: code, message: 'La cotización no está disponible.' })
  }
}
