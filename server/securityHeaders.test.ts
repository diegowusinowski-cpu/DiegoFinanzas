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
    expect(vercel.headers).toEqual([{ source: '/(.*)', headers: [...SECURITY_HEADERS] }])
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
