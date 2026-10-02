// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SECURITY_HEADERS } from './securityHeaders.ts'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  functions: Record<string, { maxDuration: number }>
  rewrites: Array<{ source: string; destination: string }>
}

describe('configuración de producción (vercel.json)', () => {
  it('aplica a todo el sitio las mismas cabeceras de seguridad que se prueban en el build', () => {
    expect(vercel.headers[0]).toEqual({ source: '/(.*)', headers: [...SECURITY_HEADERS] })
  })

  it('el resto de las cabeceras solo ajusta el caché de la PWA (service worker, manifest, íconos)', () => {
    const rest = vercel.headers.slice(1)
    expect(rest.map((h) => h.source)).toEqual(['/sw.js', '/manifest.webmanifest', '/(icons|splash)/(.*)'])
    // El service worker nunca se cachea: así cada despliegue lo actualiza.
    expect(rest[0]?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' })
    // Ninguna regla de caché toca el backend ni los datos.
    expect(vercel.headers.some((h) => h.source.includes('api'))).toBe(false)
  })

  it('la política de contenido solo permite lo que la app usa', () => {
    const csp = SECURITY_HEADERS.find((h) => h.key === 'Content-Security-Policy')?.value ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("connect-src 'self' https://dolarapi.com https://api.bluelytics.com.ar")
  })

  it('publica el backend como función y no lo pisa el reenvío a la app', () => {
    expect(vercel.functions['api/dwf.ts']?.maxDuration).toBeGreaterThan(0)
    expect(vercel.rewrites[0]?.source).toContain('(?!api/)')
  })
})
