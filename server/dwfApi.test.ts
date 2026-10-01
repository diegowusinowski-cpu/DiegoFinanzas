// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MIGRATIONS, createDwfHandler, createSessionToken, migrate, parseOps, readSessionToken, type Db } from '../api/dwf.ts'
import { pgliteDb } from './pgliteDb.ts'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

type Handler = ReturnType<typeof createDwfHandler>

interface Reply {
  status: number
  body: Record<string, unknown>
  cookie: string | undefined
  headers: Record<string, string | string[]>
}

function client(handler: Handler, baseHeaders: Record<string, string> = {}) {
  let cookie: string | undefined
  const call = async (
    body: unknown,
    over: { method?: string; headers?: Record<string, string>; rawBody?: unknown; cookie?: string | null } = {},
  ): Promise<Reply> => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-dwf-request': '1',
      ...baseHeaders,
      ...over.headers,
    }
    const sent = over.cookie === undefined ? cookie : (over.cookie ?? undefined)
    if (sent) headers.cookie = sent
    const out: Reply = { status: 0, body: {}, cookie: undefined, headers: {} }
    const res = {
      statusCode: 200,
      setHeader: (name: string, value: string | string[]) => {
        out.headers[name.toLowerCase()] = value
      },
      end: (payload?: string) => {
        out.status = res.statusCode
        out.body = payload ? (JSON.parse(payload) as Record<string, unknown>) : {}
      },
    }
    await handler({ method: over.method ?? 'POST', url: '/api/dwf', headers, body: over.rawBody ?? body }, res)
    const set = out.headers['set-cookie']
    if (typeof set === 'string') {
      out.cookie = set
      cookie = set.startsWith('dwf_session=;') || /Max-Age=0/.test(set) ? undefined : set.split(';')[0]
    }
    return out
  }
  return { call, get cookie() { return cookie }, clear: () => { cookie = undefined } }
}

const PHONE = '+5491123456789'
let clock = 1_000_000
const open: Array<{ close(): Promise<void> }> = []

async function setup(env: Record<string, string | undefined> = { NODE_ENV: 'production' }) {
  const db = await pgliteDb()
  open.push(db)
  const handler = createDwfHandler({ getDb: async () => db, now: () => clock, env })
  return { db, handler, api: client(handler) }
}

afterEach(async () => {
  while (open.length) await open.pop()!.close()
})

describe('schema y migraciones', () => {
  it('crea las tablas y no repite migraciones', async () => {
    const db = await pgliteDb()
    open.push(db)
    expect(await migrate(db)).toEqual(MIGRATIONS.map((m) => m.id))
    expect(await migrate(db)).toEqual([])
    const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).map((r) => r.table_name)
    expect(tables).toEqual(expect.arrayContaining(['users', 'documents', 'app_secrets', 'schema_migrations']))
  })
})

describe('acceso con PIN', () => {
  it('sin cuenta: perfil vacío; el alta guarda el PIN solo como hash y abre sesión', async () => {
    const { db, api } = await setup()
    expect((await api.call({ action: 'profile' })).body).toMatchObject({ profile: null, authenticated: false })
    const enrolled = await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    expect(enrolled.status).toBe(200)
    expect(enrolled.cookie).toMatch(/^dwf_session=.+HttpOnly/)
    expect(enrolled.cookie).toMatch(/SameSite=Strict/)
    expect(enrolled.cookie).toMatch(/Secure/)
    const [user] = await db.query('SELECT * FROM users')
    expect(user?.pin_hash).toBeTruthy()
    expect(String(user?.pin_hash)).not.toContain('1234')
    expect(Object.entries(user ?? {}).filter(([key]) => key !== 'phone').map(([, v]) => String(v))).not.toContain('1234')
    expect((await api.call({ action: 'profile' })).body).toMatchObject({ authenticated: true })
  })

  it('nunca expone el teléfono completo antes de entrar', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    const reply = await api.call({ action: 'profile' }, { cookie: null })
    const phone = (reply.body.profile as { phone: string }).phone
    expect(phone).not.toBe(PHONE)
    expect(phone.endsWith('789')).toBe(true)
    expect(phone).toHaveLength(PHONE.length)
    expect(reply.body.authenticated).toBe(false)
  })

  it('solo una cuenta: un segundo alta no pisa a la primera', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    const second = await api.call({ action: 'enroll', phone: '+5491100000000', pin: '9999' }, { cookie: null })
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('already_enrolled')
    expect((await api.call({ action: 'login', pin: '1234' }, { cookie: null })).body.status).toBe('ok')
  })

  it.each([
    ['teléfono', { phone: '123', pin: '1234' }],
    ['PIN corto', { phone: PHONE, pin: '12' }],
    ['PIN con letras', { phone: PHONE, pin: 'abcd' }],
  ])('rechaza datos inválidos: %s', async (_name, data) => {
    const { api } = await setup()
    expect((await api.call({ action: 'enroll', ...data })).status).toBe(400)
  })

  it('PIN correcto entra; incorrecto cuenta intentos y bloquea al quinto, con bloqueo progresivo', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    api.clear()
    expect((await api.call({ action: 'login', pin: '0000' })).body).toEqual({ status: 'invalid', attemptsLeft: 4 })
    expect((await api.call({ action: 'login', pin: '1234' })).body.status).toBe('ok') // el acierto reinicia el contador
    api.clear()
    for (const left of [4, 3, 2, 1]) expect((await api.call({ action: 'login', pin: '9999' })).body).toEqual({ status: 'invalid', attemptsLeft: left })
    const locked = await api.call({ action: 'login', pin: '9999' })
    expect(locked.body).toMatchObject({ status: 'locked', retryAt: clock + 30_000 })
    // Bloqueado: ni el PIN correcto entra hasta que pase el tiempo.
    expect((await api.call({ action: 'login', pin: '1234' })).body.status).toBe('locked')
    expect((await api.call({ action: 'profile' })).body.lockedUntil).toBe(clock + 30_000)
    clock += 30_001
    expect((await api.call({ action: 'login', pin: '1234' })).body.status).toBe('ok')
  })

  it('intentos en paralelo no evitan el bloqueo', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    api.clear()
    const replies = await Promise.all(Array.from({ length: 12 }, (_, i) => api.call({ action: 'login', pin: String(1000 + i) })))
    expect(replies.filter((r) => r.body.status === 'ok')).toHaveLength(0)
    expect(replies.some((r) => r.body.status === 'locked')).toBe(true)
    expect(replies.filter((r) => r.body.status === 'invalid').length).toBeLessThanOrEqual(5)
    clock += 60_000
  })

  it('cerrar sesión borra la cookie y corta el acceso a los datos', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    expect((await api.call({ action: 'list', collection: 'transactions' })).status).toBe(200)
    const out = await api.call({ action: 'logout' })
    expect(out.cookie).toMatch(/Max-Age=0/)
    expect((await api.call({ action: 'list', collection: 'transactions' })).status).toBe(401)
  })
})

describe('sesión firmada', () => {
  it('se valida la firma y el vencimiento', () => {
    const token = createSessionToken('u1', 'secreto', 1_000_000)
    expect(readSessionToken(token, 'secreto', 1_000_000)).toBe('u1')
    expect(readSessionToken(token, 'otro-secreto', 1_000_000)).toBeNull()
    expect(readSessionToken(`${token}x`, 'secreto', 1_000_000)).toBeNull()
    expect(readSessionToken(token, 'secreto', 1_000_000 + 13 * 3600 * 1000)).toBeNull()
    expect(readSessionToken(undefined, 'secreto', 1)).toBeNull()
    expect(readSessionToken('basura', 'secreto', 1)).toBeNull()
  })

  it('un token de otra base/secreto no sirve', async () => {
    const a = await setup()
    await a.api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    const b = await setup()
    await b.api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    const foreign = a.api.cookie
    expect((await b.api.call({ action: 'list', collection: 'transactions' }, { cookie: foreign ?? null })).status).toBe(401)
  })

  it('SESSION_SECRET del entorno reemplaza al secreto guardado', async () => {
    const { db, api } = await setup({ NODE_ENV: 'production', SESSION_SECRET: 'fijo' })
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    expect(await db.query("SELECT * FROM app_secrets WHERE name = 'session'")).toHaveLength(0)
    expect((await api.call({ action: 'list', collection: 'transactions' })).status).toBe(200)
  })
})

describe('datos', () => {
  const tx = (id: string, extra: object = {}) => ({ id, description: id, amount: 1000, status: 'COMPLETED', ...extra })

  async function loggedIn() {
    const ctx = await setup()
    await ctx.api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    return ctx
  }

  it('exige sesión para leer y escribir', async () => {
    const { api } = await setup()
    await api.call({ action: 'enroll', phone: PHONE, pin: '1234' })
    api.clear()
    expect((await api.call({ action: 'list', collection: 'transactions' })).status).toBe(401)
    expect((await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a')] }] })).status).toBe(401)
  })

  it('guarda y devuelve los datos en orden de creación; reemplazar un dato no cambia su lugar', async () => {
    const { api } = await loggedIn()
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a'), tx('b')] }] })
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('c')] }] })
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a', { status: 'CANCELLED' })] }] })
    const { items } = (await api.call({ action: 'list', collection: 'transactions' })).body as { items: Array<{ id: string; status: string }> }
    expect(items.map((i) => [i.id, i.status])).toEqual([['a', 'CANCELLED'], ['b', 'COMPLETED'], ['c', 'COMPLETED']])
  })

  it('las colecciones son independientes', async () => {
    const { api } = await loggedIn()
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a')] }, { collection: 'savings-jars', items: [{ id: 'j1', name: 'Viaje' }] }] })
    expect(((await api.call({ action: 'list', collection: 'savings-jars' })).body.items as unknown[]).length).toBe(1)
    expect(((await api.call({ action: 'list', collection: 'loans' })).body.items as unknown[]).length).toBe(0)
  })

  it('una escritura con varias colecciones es atómica: si una falla, no se guarda ninguna', async () => {
    const { api } = await loggedIn()
    const bad = await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a')] }, { collection: 'loans', items: [{ nombre: 'sin id' }] }] })
    expect(bad.status).toBe(400)
    expect(((await api.call({ action: 'list', collection: 'transactions' })).body.items as unknown[]).length).toBe(0)
  })

  it('si falla la base en medio de la transacción no queda nada a medias', async () => {
    const { db, api } = await loggedIn()
    const failing: Db = {
      query: (t, p) => db.query(t, p),
      batch: (statements) => db.batch([...statements, { text: 'SELECT * FROM tabla_que_no_existe' }]),
    }
    const handler = createDwfHandler({ getDb: async () => failing, now: () => clock, env: { NODE_ENV: 'production' } })
    const broken = client(handler)
    const cookie = api.cookie
    const reply = await broken.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('zzz')] }] }, { cookie: cookie ?? null })
    expect(reply.status).toBe(500)
    expect(((await api.call({ action: 'list', collection: 'transactions' })).body.items as unknown[]).length).toBe(0)
  })

  it('no existe ninguna acción para borrar datos', async () => {
    const { api, db } = await loggedIn()
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a')] }] })
    for (const action of ['delete', 'remove', 'clear', 'drop', 'truncate', 'reset']) {
      expect((await api.call({ action, collection: 'transactions', id: 'a' })).status).toBe(400)
    }
    expect(await db.query("SELECT id FROM documents WHERE collection='transactions'")).toHaveLength(1)
  })

  it('rechaza colecciones fuera de la lista, ids inválidos y pedidos enormes', async () => {
    const { api } = await loggedIn()
    expect((await api.call({ action: 'list', collection: 'users' })).status).toBe(400)
    expect((await api.call({ action: 'apply', ops: [{ collection: 'users', items: [tx('a')] }] })).status).toBe(400)
    expect((await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [{ id: '' }] }] })).status).toBe(400)
    expect((await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [{ id: 'x'.repeat(200) }] }] })).status).toBe(400)
    expect((await api.call({ action: 'apply', ops: [] })).status).toBe(400)
    const many = Array.from({ length: 2001 }, (_, i) => tx(`t${i}`))
    expect((await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: many }] })).status).toBe(413)
  })

  it('parseOps junta ids repetidos (gana el último)', () => {
    const ops = parseOps([{ collection: 'transactions', items: [{ id: 'a', v: 1 }, { id: 'a', v: 2 }] }])
    expect(ops[0]?.items).toEqual([{ id: 'a', v: 2 }])
  })

  it('los datos de una cuenta no se mezclan con los de otra', async () => {
    const { db, api } = await loggedIn()
    await api.call({ action: 'apply', ops: [{ collection: 'transactions', items: [tx('a')] }] })
    await db.query("INSERT INTO users (id, phone, display_name, pin_hash, pin_salt, pin_iterations) VALUES ('otro','+5491100000001','X','h','s',1)")
    await db.query(`INSERT INTO documents (user_id, collection, id, data) VALUES ('otro','transactions','ajeno','{"id":"ajeno"}')`)
    const { items } = (await api.call({ action: 'list', collection: 'transactions' })).body as { items: Array<{ id: string }> }
    expect(items.map((i) => i.id)).toEqual(['a'])
  })
})

describe('seguridad del endpoint', () => {
  it('solo acepta POST JSON con la cabecera propia (protege de CSRF) y no habilita CORS', async () => {
    const { api } = await setup()
    expect((await api.call({ action: 'health' }, { method: 'GET' })).status).toBe(405)
    expect((await api.call({ action: 'health' }, { headers: { 'content-type': 'text/plain' } })).status).toBe(400)
    const noHeader = client((await setup()).handler, { 'x-dwf-request': '' })
    expect((await noHeader.call({ action: 'health' })).status).toBe(400)
    const ok = await api.call({ action: 'health' })
    expect(ok.status).toBe(200)
    expect(ok.headers['access-control-allow-origin']).toBeUndefined()
    expect(ok.headers['cache-control']).toBe('no-store')
  })

  it('JSON inválido o sin acción: 400, nunca 500', async () => {
    const { api } = await setup()
    expect((await api.call(null, { rawBody: '{no' })).status).toBe(400)
    expect((await api.call({})).status).toBe(400)
    expect((await api.call({ action: 'hacer-algo' })).status).toBe(400)
  })

  it('sin base configurada responde db_not_configured; si la base falla, db_unavailable', async () => {
    const none = client(createDwfHandler({ getDb: async () => null, env: {} }))
    expect(await none.call({ action: 'health' })).toMatchObject({ status: 503, body: { error: 'db_not_configured' } })
    const broken = client(
      createDwfHandler({
        getDb: async () => {
          throw new Error('connection refused')
        },
        env: {},
      }),
    )
    const reply = await broken.call({ action: 'health' })
    expect(reply).toMatchObject({ status: 503, body: { error: 'db_unavailable' } })
    expect(JSON.stringify(reply.body)).not.toContain('connection refused') // no filtra detalles internos
  })
})

describe('persistencia real en disco', () => {
  it('los datos sobreviven a cerrar y volver a abrir la base (reinicio del servidor / nueva versión)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dwf-db-'))
    try {
      const first = await pgliteDb(dir)
      const a = client(createDwfHandler({ getDb: async () => first, now: () => clock, env: {} }))
      await a.call({ action: 'enroll', phone: PHONE, pin: '1234' })
      await a.call({ action: 'apply', ops: [{ collection: 'transactions', items: [{ id: 'm1', amount: 5000, status: 'COMPLETED' }, { id: 'm2', amount: 700, status: 'SCHEDULED' }] }, { collection: 'manual-balances', items: [{ id: 'usd-balance', amount: 100000 }] }] })
      await first.close()

      const second = await pgliteDb(dir)
      open.push(second)
      const b = client(createDwfHandler({ getDb: async () => second, now: () => clock, env: {} }))
      expect((await b.call({ action: 'login', pin: '1234' })).body.status).toBe('ok') // misma cuenta y PIN
      const { items } = (await b.call({ action: 'list', collection: 'transactions' })).body as { items: Array<{ id: string; status: string }> }
      expect(items.map((i) => [i.id, i.status])).toEqual([['m1', 'COMPLETED'], ['m2', 'SCHEDULED']])
      expect(((await b.call({ action: 'list', collection: 'manual-balances' })).body.items as Array<{ amount: number }>)[0]?.amount).toBe(100000)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
