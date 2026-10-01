// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDwfHandler } from '../api/dwf.ts'
import { pgliteDb } from './pgliteDb.ts'
import { RemoteAuthService } from '../src/services/remoteAuth'
import {
  buildInstallmentPayment,
  buildJar,
  buildLoanBundle,
  buildTransaction,
  buildUsdBalance,
  computeBalance,
  type Transaction,
} from '../src/domain'
import { ApiClient, ApiError, ApiUnreachableError } from '../src/data/apiClient'
import { createRepositories } from '../src/data/documentRepositories'
import { RemoteDocumentStore } from '../src/data/remoteStore'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const NOW = new Date(2026, 9, 6, 12, 0)
const open: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  while (open.length) await open.pop()!.close()
})

/** "Navegador" de prueba: un fetch que habla con el backend real (PGlite) y guarda cookies como un navegador. */
function browser(handler: ReturnType<typeof createDwfHandler>) {
  let cookie: string | undefined
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
    if (cookie) headers.cookie = cookie
    let status = 200
    let payload = ''
    const out: Record<string, string> = {}
    await handler(
      { method: init.method, url: '/api/dwf', headers, body: JSON.parse(String(init.body)) },
      {
        get statusCode() {
          return status
        },
        set statusCode(value: number) {
          status = value
        },
        setHeader: (name: string, value: string | string[]) => {
          out[name.toLowerCase()] = String(value)
        },
        end: (body?: string) => {
          payload = body ?? ''
        },
      },
    )
    if (out['set-cookie']) cookie = /Max-Age=0/.test(out['set-cookie']) ? undefined : out['set-cookie'].split(';')[0]
    return new Response(payload, { status })
  }) as unknown as typeof fetch
  return { fetchImpl, clearCookie: () => (cookie = undefined), get cookie() { return cookie } }
}

async function setup() {
  const db = await pgliteDb()
  open.push(db)
  const handler = createDwfHandler({ getDb: async () => db, env: { NODE_ENV: 'production' } })
  const web = browser(handler)
  const unauthorized = vi.fn()
  const client = new ApiClient('/api/dwf', web.fetchImpl, unauthorized)
  const auth = new RemoteAuthService(client)
  await auth.enroll({ phone: '11 2345 6789', pin: '1234' })
  const repos = createRepositories(new RemoteDocumentStore(client))
  return { db, handler, web, client, auth, repos, unauthorized }
}

const tx = (id: string, over: Partial<Parameters<typeof buildTransaction>[0]> = {}): Transaction =>
  buildTransaction(
    { accountId: 'acc-main', type: 'INCOME', amount: 10_000, description: id, categoryId: 'inc-employment', date: '2026-10-06', time: '10:00', ...over },
    { id, now: NOW },
  )

describe('ApiClient', () => {
  it('sin red lanza ApiUnreachableError(network); una página que no es JSON, (no-backend)', async () => {
    const down = new ApiClient('/api/dwf', (async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch)
    await expect(down.call('health')).rejects.toMatchObject({ name: 'ApiUnreachableError', reason: 'network' })
    const html = new ApiClient('/api/dwf', (async () => new Response('<html>404</html>', { status: 404 })) as unknown as typeof fetch)
    await expect(html.call('health')).rejects.toMatchObject({ reason: 'no-backend' })
    expect(new ApiUnreachableError().reason).toBe('network')
  })

  it('traduce los errores del servidor y avisa cuando la sesión venció', async () => {
    const onUnauthorized = vi.fn()
    const reply = (status: number, body: object) => (async () => Response.json(body, { status })) as unknown as typeof fetch
    await expect(new ApiClient('/api/dwf', reply(503, { error: 'db_not_configured', message: 'Falta DATABASE_URL' }), onUnauthorized).call('health')).rejects.toMatchObject({
      status: 503,
      code: 'db_not_configured',
      message: 'Falta DATABASE_URL',
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
    await expect(new ApiClient('/api/dwf', reply(401, { error: 'unauthorized', message: 'venció' }), onUnauthorized).call('list')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('envía JSON con la cabecera propia, sin guardar credenciales', async () => {
    const seen: RequestInit[] = []
    const client = new ApiClient('/api/dwf', (async (_u: string, init: RequestInit) => {
      seen.push(init)
      return Response.json({ ok: true })
    }) as unknown as typeof fetch)
    await client.call('health')
    expect(seen[0]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    expect((seen[0]?.headers as Record<string, string>)['X-DWF-Request']).toBe('1')
  })
})

describe('acceso remoto', () => {
  it('alta, perfil sin teléfono completo, PIN incorrecto y correcto', async () => {
    const { auth, web } = await setup()
    web.clearCookie()
    const profile = await auth.getProfile()
    expect(profile?.displayName).toBe('Diego')
    expect(profile?.phone).not.toBe('+5491123456789')
    expect(await auth.verifyPin('0000')).toEqual({ status: 'invalid', attemptsLeft: 4 })
    expect(await auth.verifyPin('1234')).toEqual({ status: 'ok' })
  })

  it('un segundo alta es rechazado con un mensaje claro', async () => {
    const { auth } = await setup()
    await expect(auth.enroll({ phone: '11 5555 5555', pin: '9999' })).rejects.toThrow(/ya tiene un PIN/)
  })

  it('valida el teléfono y el PIN antes de enviar', async () => {
    const { auth } = await setup()
    await expect(auth.enroll({ phone: 'abc', pin: '1234' })).rejects.toThrow(/teléfono/)
    await expect(auth.enroll({ phone: '11 2345 6789', pin: '12' })).rejects.toThrow(/4 dígitos/)
  })

  it('bloquea tras 5 intentos fallidos y lo informa', async () => {
    const { auth, web } = await setup()
    web.clearCookie()
    for (let i = 0; i < 4; i++) await auth.verifyPin('9999')
    expect((await auth.verifyPin('9999')).status).toBe('locked')
    expect(await auth.getLockedUntil()).toBeGreaterThan(Date.now())
  })

  it('cerrar sesión corta el acceso y avisa que hay que volver a ingresar el PIN', async () => {
    const { auth, repos, unauthorized } = await setup()
    await repos.transactions.add(tx('a'))
    await auth.signOut()
    await expect(repos.transactions.list()).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toHaveBeenCalled()
    await auth.verifyPin('1234')
    expect(await repos.transactions.list()).toHaveLength(1)
  })
})

describe('repositorios sobre la base de datos', () => {
  it('guardan movimientos con sus estados COMPLETED / SCHEDULED / CANCELLED y no se pierden', async () => {
    const { repos } = await setup()
    const completed = tx('completado')
    const scheduled = { ...tx('programado', { date: '2026-12-01' }), status: 'SCHEDULED' as const }
    const cancelled = { ...tx('anulado'), status: 'CANCELLED' as const }
    for (const t of [completed, scheduled, cancelled]) await repos.transactions.add(t)
    const list = await repos.transactions.list()
    expect(list.map((t) => [t.id, t.status])).toEqual([
      ['completado', 'COMPLETED'],
      ['programado', 'SCHEDULED'],
      ['anulado', 'CANCELLED'],
    ])
    // El programado pasa a efectivo: se actualiza el mismo movimiento, sin duplicar ni perder el historial.
    await repos.transactions.update([{ ...scheduled, status: 'COMPLETED' }])
    expect((await repos.transactions.list()).map((t) => [t.id, t.status])).toEqual([
      ['completado', 'COMPLETED'],
      ['programado', 'COMPLETED'],
      ['anulado', 'CANCELLED'],
    ])
  })

  it('el saldo se calcula a partir de lo persistido (solo movimientos COMPLETED)', async () => {
    const { repos } = await setup()
    await repos.transactions.add(tx('sueldo', { amount: 500_000 }))
    await repos.transactions.add(tx('gasto', { type: 'EXPENSE', amount: 120_000, categoryId: 'exp-leisure' }))
    await repos.transactions.add({ ...tx('futuro', { amount: 99_999 }), status: 'SCHEDULED' })
    await repos.transactions.add({ ...tx('anulado', { amount: 77_777 }), status: 'CANCELLED' })
    expect(computeBalance(await repos.transactions.list(), undefined, 'ARS')).toBe(380_000)
  })

  it('un préstamo se guarda completo y de una vez: préstamo + cuotas + movimiento, y el cobro también', async () => {
    const { repos } = await setup()
    let n = 0
    const bundle = buildLoanBundle(
      { accountId: 'acc-main', borrowerName: 'Ana', principalAmount: 1_000_000, installmentCount: 4, loanDate: '2026-10-02', dueDate: '2026-12-02' },
      { now: NOW, newId: () => `l-${++n}` },
    )
    await repos.loans.create(bundle)
    expect(await repos.loans.listLoans()).toEqual([bundle.loan])
    expect(await repos.loans.listInstallments()).toHaveLength(4)
    expect((await repos.transactions.list()).map((t) => t.id)).toEqual([bundle.transaction.id])

    const paid = buildInstallmentPayment(bundle.loan, bundle.installments[0]!, bundle.installments, { now: NOW, newId: () => 'pago', accountId: 'acc-main' })
    if (!paid.ok) throw new Error('debió cobrar')
    await repos.loans.recordPayment(paid.value)
    expect((await repos.loans.listInstallments()).filter((i) => i.status === 'PAID')).toHaveLength(1)
    expect((await repos.transactions.list()).map((t) => t.id).sort()).toEqual([bundle.transaction.id, 'pago'].sort())
  })

  it('ahorros y dólares cargados a mano', async () => {
    const { repos } = await setup()
    const jar = buildJar({ name: 'Viaje', targetAmount: 1_000_000, targetDate: null, plan: { frequency: 'WEEKLY', amount: 50_000 } }, { now: NOW, newId: () => 'j1' })
    await repos.savings.createJar(jar)
    await repos.savings.addContribution({ id: 'c1', jarId: 'j1', amount: 200_000, date: '2026-10-06', createdAt: NOW.toISOString() })
    await repos.savings.addContribution({ id: 'c2', jarId: 'j1', amount: 100_000, date: '2026-10-07', createdAt: NOW.toISOString() })
    expect(await repos.savings.listJars()).toEqual([jar])
    expect((await repos.savings.listContributions()).map((c) => c.amount)).toEqual([200_000, 100_000])
    await repos.manualBalances.setUsd(buildUsdBalance(100_000, NOW))
    await repos.manualBalances.setUsd(buildUsdBalance(250_050, NOW))
    expect((await repos.manualBalances.getUsd())?.amount).toBe(250_050)
  })

  it('cuenta principal y categorías: se crean una sola vez', async () => {
    const { repos } = await setup()
    const first = await repos.accounts.ensureDefault(NOW)
    const second = await repos.accounts.ensureDefault(new Date(2027, 0, 1))
    expect(second).toEqual(first)
    expect(await repos.accounts.list()).toHaveLength(1)
    const categories = await repos.categories.list()
    expect(categories.find((c) => c.id === 'exp-subscriptions')).toBeTruthy()
    expect(await repos.categories.list()).toEqual(categories)
  })

  it('al abrir la app desde otro dispositivo (otra sesión) se ven los mismos datos', async () => {
    const { handler, repos } = await setup()
    await repos.transactions.add(tx('a'))
    const other = browser(handler)
    const otherClient = new ApiClient('/api/dwf', other.fetchImpl)
    expect(await new RemoteAuthService(otherClient).verifyPin('1234')).toEqual({ status: 'ok' })
    expect((await createRepositories(new RemoteDocumentStore(otherClient)).transactions.list()).map((t) => t.id)).toEqual(['a'])
  })

  it('no existe forma de borrar desde los repositorios', async () => {
    const { repos } = await setup()
    for (const repo of Object.values(repos)) {
      expect(repo).not.toHaveProperty('delete')
      expect(repo).not.toHaveProperty('remove')
    }
  })
})
