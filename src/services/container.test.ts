import { describe, expect, it } from 'vitest'
import { ApiClient } from '@/data/apiClient'
import { MemoryStorage } from '@/data/storage'
import { applyPreviewReset, detectDataMode } from './container'

const clientFor = (impl: () => Promise<Response>) => new ApiClient('/api/dwf', impl as unknown as typeof fetch)

describe('detectDataMode: dónde viven los datos', () => {
  it('backend con base de datos lista → base de datos real', async () => {
    expect(await detectDataMode(clientFor(async () => Response.json({ ok: true })), undefined)).toBe('database')
  })

  it('backend sin DATABASE_URL → "sin configurar" (no se guarda nada en el dispositivo)', async () => {
    const reply = async () => Response.json({ error: 'db_not_configured', message: 'falta' }, { status: 503 })
    expect(await detectDataMode(clientFor(reply), undefined)).toBe('unconfigured')
  })

  it('sitio estático sin backend (404 HTML) → respaldo local', async () => {
    expect(await detectDataMode(clientFor(async () => new Response('<html>404</html>', { status: 404 })), undefined)).toBe('local')
  })

  it('sin conexión o base caída → sigue siendo base de datos: nunca guarda en el dispositivo por error', async () => {
    expect(await detectDataMode(clientFor(async () => Promise.reject(new TypeError('Failed to fetch'))), undefined)).toBe('database')
    const down = async () => Response.json({ error: 'db_unavailable', message: 'x' }, { status: 503 })
    expect(await detectDataMode(clientFor(down), undefined)).toBe('database')
  })

  it('la previsualización puede forzar el modo local sin consultar al servidor', async () => {
    let called = false
    const client = clientFor(async () => {
      called = true
      return Response.json({ ok: true })
    })
    expect(await detectDataMode(client, 'local')).toBe('local')
    expect(called).toBe(false)
  })
})

describe('applyPreviewReset: limpieza única de los datos de prueba de la previsualización', () => {
  const seed = () => {
    const storage = new MemoryStorage()
    for (const key of [
      'transactions',
      'loans',
      'loan-installments',
      'savings-jars',
      'savings-contributions',
      'manual-balances',
      'reminders',
      'accounts',
      'categories',
      'auth',
    ]) {
      storage.setItem(`dwf.v1.${key}`, '{"version":1,"items":[{"id":"x"}]}')
    }
    return storage
  }
  const DATA = ['transactions', 'loans', 'loan-installments', 'savings-jars', 'savings-contributions', 'manual-balances']

  it('sin token no toca nada (así es en producción)', () => {
    const storage = seed()
    applyPreviewReset(storage, undefined)
    expect(DATA.every((k) => storage.getItem(`dwf.v1.${k}`) !== null)).toBe(true)
  })

  it('con token nuevo borra movimientos, préstamos, cuotas, ahorros y dólares, y conserva cuenta, PIN y recordatorios', () => {
    const storage = seed()
    applyPreviewReset(storage, 't1')
    expect(DATA.every((k) => storage.getItem(`dwf.v1.${k}`) === null)).toBe(true)
    for (const k of ['reminders', 'accounts', 'categories', 'auth']) expect(storage.getItem(`dwf.v1.${k}`)).not.toBeNull()
  })

  it('solo borra una vez por token: lo que se cargue después se conserva', () => {
    const storage = seed()
    applyPreviewReset(storage, 't1')
    storage.setItem('dwf.v1.transactions', '{"version":1,"items":[{"id":"real"}]}')
    applyPreviewReset(storage, 't1')
    expect(storage.getItem('dwf.v1.transactions')).toContain('real')
    applyPreviewReset(storage, 't2') // un token distinto vuelve a limpiar
    expect(storage.getItem('dwf.v1.transactions')).toBeNull()
  })
})
