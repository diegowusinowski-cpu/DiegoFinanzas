/**
 * `POST /api/dwf` — backend de DWF: base de datos PostgreSQL, acceso con PIN y datos de la app.
 *
 * Es un único endpoint con acciones (`{ action, ... }`) para que funcione igual en Vercel (función
 * serverless) y en `vite dev`/`vite preview` (ver `server/dwfApi.ts`). Es autocontenido (sin imports
 * relativos) para que Vercel lo empaquete sin depender de la resolución de módulos del repositorio.
 *
 * Datos: cada colección de la app (movimientos, préstamos, cuotas, ahorros…) se guarda como documentos
 * JSON en la tabla `documents`. No existe ninguna acción de borrado: los datos solo se agregan o se
 * reemplazan (los movimientos se anulan cambiando su estado, nunca se eliminan).
 *
 * Seguridad: el PIN se guarda solo como hash PBKDF2 con sal; los intentos fallidos se cuentan en la
 * base (bloqueo progresivo, a prueba de intentos en paralelo); la sesión es una cookie firmada
 * HttpOnly + SameSite=Strict (+ Secure en HTTPS); solo se aceptan POST JSON con la cabecera propia
 * `X-DWF-Request`; no hay CORS (solo el mismo origen); el contenido se valida y se limita su tamaño.
 *
 * Configuración: `DATABASE_URL` (o `POSTGRES_URL`) apuntando a un Postgres de Neon. Nada más: el schema
 * se crea/actualiza solo (`MIGRATIONS`) y el secreto de sesión se genera y guarda en la base.
 * Opcional: `SESSION_SECRET` para fijar el secreto de sesión.
 *
 * Solo sintaxis "borrable" de TypeScript (sin enums ni propiedades de constructor) para poder
 * ejecutarlo directamente con Node desde `scripts/db.mjs`.
 */
import { createHmac, pbkdf2, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

/* ── Base de datos ──────────────────────────────────────────────────────── */

export interface SqlStatement {
  text: string
  params?: unknown[]
}

export type Row = Record<string, unknown>

/** Lo mínimo que el backend necesita de PostgreSQL (Neon en producción, PGlite en local y en pruebas). */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>
  /** Ejecuta varias sentencias en UNA transacción: o se aplican todas o ninguna. */
  batch(statements: SqlStatement[]): Promise<void>
}

type Env = Record<string, string | undefined>

export function databaseUrl(env: Env = process.env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_URL_NON_POOLING || undefined
}

/** Producción: Postgres de Neon por HTTPS (funciona en funciones serverless, sin conexiones persistentes). */
export async function neonDb(url: string): Promise<Db> {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(url)
  return {
    query: async (text, params) => (await sql.query(text, params ?? [])) as Row[],
    batch: async (statements) => {
      await sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? [])))
    },
  }
}

/* ── Schema (migraciones) ───────────────────────────────────────────────── */

export interface Migration {
  id: string
  statements: string[]
}

/** Las migraciones se aplican solas, en orden, una única vez. Para cambiar el schema se agrega una nueva. */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: '001_init',
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        phone text NOT NULL UNIQUE,
        display_name text NOT NULL,
        pin_hash text NOT NULL,
        pin_salt text NOT NULL,
        pin_iterations integer NOT NULL,
        failed_attempts integer NOT NULL DEFAULT 0,
        locked_until bigint,
        lock_count integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS documents (
        user_id text NOT NULL REFERENCES users(id),
        collection text NOT NULL,
        id text NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (user_id, collection, id)
      )`,
      `CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (user_id, collection, created_at)`,
      `CREATE TABLE IF NOT EXISTS app_secrets (
        name text PRIMARY KEY,
        value text NOT NULL
      )`,
    ],
  },
]

/** Crea o actualiza el schema. Devuelve los ids de las migraciones que aplicó (vacío si ya estaba al día). */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  )
  const done = new Set((await db.query('SELECT id FROM schema_migrations')).map((r) => String(r.id)))
  const applied: string[] = []
  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue
    await db.batch([
      ...migration.statements.map((text) => ({ text })),
      { text: 'INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', params: [migration.id] },
    ])
    applied.push(migration.id)
  }
  return applied
}

/* ── Colecciones de datos ───────────────────────────────────────────────── */

/** Únicas colecciones aceptadas (coinciden con los nombres que usa la app). */
export const COLLECTIONS = [
  'transactions',
  'accounts',
  'categories',
  'reminders',
  'loans',
  'loan-installments',
  'savings-jars',
  'savings-contributions',
  'manual-balances',
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

const MAX_BODY_BYTES = 1_000_000
const MAX_ITEMS_PER_REQUEST = 2_000
const MAX_ID_LENGTH = 120

const UPSERT_SQL = `INSERT INTO documents (user_id, collection, id, data)
SELECT $1, $2, e->>'id', e FROM jsonb_array_elements($3::jsonb) AS e
ON CONFLICT (user_id, collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = clock_timestamp()`

/* ── Contraseña (PIN) y sesión ──────────────────────────────────────────── */

const PIN_REGEX = /^\d{4}$/
const PHONE_REGEX = /^\+\d{10,15}$/
const PBKDF2_ITERATIONS = 210_000
const MAX_FREE_ATTEMPTS = 5
const BASE_LOCK_MS = 30_000
const MAX_LOCK_MS = 15 * 60_000
const SESSION_COOKIE = 'dwf_session'
const SESSION_TTL_SECONDS = 12 * 3600
const DEFAULT_DISPLAY_NAME = 'Diego'

function derivePin(pin: string, salt: Buffer, iterations: number): Promise<string> {
  return new Promise((resolve, reject) => {
    pbkdf2(pin, salt, iterations, 32, 'sha256', (error, key) => (error ? reject(error) : resolve(key.toString('base64'))))
  })
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = randomBytes(16)
  return { hash: await derivePin(pin, salt, PBKDF2_ITERATIONS), salt: salt.toString('base64'), iterations: PBKDF2_ITERATIONS }
}

function b64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payload).digest())
}

export function createSessionToken(userId: string, secret: string, nowMs: number): string {
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS })))
  return `${payload}.${sign(payload, secret)}`
}

export function readSessionToken(token: string | undefined, secret: string, nowMs: number): string | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: unknown; exp?: unknown }
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp * 1000 < nowMs) return null
    return data.uid
  } catch {
    return null
  }
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return undefined
}

/** `+5491123456789` → `+54000000789`: conserva el largo y los últimos dígitos sin exponer el número completo. */
function publicPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `+${digits.slice(0, 2)}${'0'.repeat(Math.max(digits.length - 5, 0))}${digits.slice(-3)}`
}

/* ── Handler HTTP ───────────────────────────────────────────────────────── */

interface Req {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>
}

interface Res {
  statusCode: number
  setHeader(name: string, value: string | string[]): void
  end(body?: string): void
}

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface DwfHandlerOptions {
  /** Devuelve la base de datos, o `null` si no está configurada. */
  getDb(): Promise<Db | null>
  now?: () => number
  env?: Env
}

function header(req: Req, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body)
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'))
    return req.body
  }
  const chunks: Buffer[] = []
  let size = 0
  const iterator = req[Symbol.asyncIterator]
  if (!iterator) return {}
  for await (const chunk of { [Symbol.asyncIterator]: iterator.bind(req) }) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'La solicitud es demasiado grande.')
    chunks.push(buffer)
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCollection(value: unknown): value is CollectionName {
  return typeof value === 'string' && (COLLECTIONS as readonly string[]).includes(value)
}

interface ValidOp {
  collection: CollectionName
  items: Record<string, unknown>[]
}

/** Valida y normaliza las escrituras: colecciones permitidas, documentos con `id` y sin ids repetidos. */
export function parseOps(value: unknown): ValidOp[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new HttpError(400, 'bad_request', 'Operaciones inválidas.')
  }
  let total = 0
  return value.map((raw): ValidOp => {
    if (!isRecord(raw) || !isCollection(raw.collection) || !Array.isArray(raw.items)) {
      throw new HttpError(400, 'bad_request', 'Operación inválida.')
    }
    const byId = new Map<string, Record<string, unknown>>()
    for (const item of raw.items) {
      if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || item.id.length > MAX_ID_LENGTH) {
        throw new HttpError(400, 'bad_request', 'Cada dato debe tener un id válido.')
      }
      byId.set(item.id, item) // si un id se repite, gana el último
    }
    total += byId.size
    if (total > MAX_ITEMS_PER_REQUEST) throw new HttpError(413, 'too_large', 'Demasiados datos en una sola solicitud.')
    return { collection: raw.collection, items: [...byId.values()] }
  })
}

/** Crea el manejador de `/api/dwf`. La base se inyecta para poder usar Neon, PGlite o una base de pruebas. */
export function createDwfHandler(options: DwfHandlerOptions): (req: Req, res: Res) => Promise<void> {
  const now = options.now ?? Date.now
  const env = options.env ?? process.env
  let ready: Promise<Db | null> | null = null
  let secret: Promise<string> | null = null

  const database = (): Promise<Db | null> => {
    ready ??= options
      .getDb()
      .then(async (db) => {
        if (db) await migrate(db)
        return db
      })
      .catch((error: unknown) => {
        ready = null // reintenta en la próxima solicitud
        throw error
      })
    return ready
  }

  const sessionSecret = (db: Db): Promise<string> => {
    secret ??= (async () => {
      if (env.SESSION_SECRET) return env.SESSION_SECRET
      await db.query('INSERT INTO app_secrets (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [
        'session',
        randomBytes(32).toString('hex'),
      ])
      const [row] = await db.query('SELECT value FROM app_secrets WHERE name = $1', ['session'])
      return String(row?.value)
    })().catch((error: unknown) => {
      secret = null
      throw error
    })
    return secret
  }

  const send = (res: Res, status: number, body: unknown, extra: Record<string, string | string[]> = {}) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    for (const [name, value] of Object.entries(extra)) res.setHeader(name, value)
    res.end(JSON.stringify(body))
  }

  const secure = (req: Req) => header(req, 'x-forwarded-proto') === 'https' || env.NODE_ENV === 'production'
  const sessionCookie = (req: Req, token: string, maxAge: number) =>
    `${SESSION_COOKIE}=${token}; Path=/api/dwf; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`

  const requireUser = async (req: Req, db: Db): Promise<string> => {
    const uid = readSessionToken(cookieValue(header(req, 'cookie'), SESSION_COOKIE), await sessionSecret(db), now())
    if (!uid) throw new HttpError(401, 'unauthorized', 'La sesión venció. Ingresá de nuevo con tu PIN.')
    return uid
  }

  const currentUser = async (db: Db): Promise<Row | undefined> => (await db.query('SELECT * FROM users LIMIT 1'))[0]

  const lockedUntilOf = (user: Row | undefined): number | null => {
    const value = user?.locked_until
    const until = value === null || value === undefined ? null : Number(value)
    return until !== null && until > now() ? until : null
  }

  return async (req, res) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método no permitido.')
      if (!(header(req, 'content-type') ?? '').toLowerCase().startsWith('application/json') || header(req, 'x-dwf-request') !== '1') {
        throw new HttpError(400, 'bad_request', 'Solicitud no válida.')
      }
      const body = await readBody(req).catch((error: unknown) => {
        if (error instanceof HttpError) throw error
        throw new HttpError(400, 'bad_request', 'El contenido no es JSON válido.')
      })
      if (!isRecord(body) || typeof body.action !== 'string') throw new HttpError(400, 'bad_request', 'Falta la acción.')

      let db: Db | null
      try {
        db = await database()
      } catch {
        throw new HttpError(503, 'db_unavailable', 'No se pudo conectar con la base de datos.')
      }
      if (!db) {
        throw new HttpError(503, 'db_not_configured', 'La base de datos no está configurada: falta la variable DATABASE_URL.')
      }

      switch (body.action) {
        case 'health':
          return send(res, 200, { ok: true })

        case 'profile': {
          const user = await currentUser(db)
          const uid = readSessionToken(cookieValue(header(req, 'cookie'), SESSION_COOKIE), await sessionSecret(db), now())
          return send(res, 200, {
            profile: user ? { phone: publicPhone(String(user.phone)), displayName: String(user.display_name) } : null,
            lockedUntil: lockedUntilOf(user),
            authenticated: Boolean(user && uid === user.id),
          })
        }

        case 'enroll': {
          const phone = body.phone
          const pin = body.pin
          if (typeof phone !== 'string' || !PHONE_REGEX.test(phone)) throw new HttpError(400, 'bad_request', 'Ingresá un número de teléfono válido.')
          if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) throw new HttpError(400, 'bad_request', 'El PIN debe tener 4 dígitos.')
          if (await currentUser(db)) {
            throw new HttpError(
              409,
              'already_enrolled',
              'Esta cuenta ya tiene un PIN. Para cambiarlo ejecutá `npm run db:reset-pin` (ver README).',
            )
          }
          const id = randomUUID()
          const { hash, salt, iterations } = await hashPin(pin)
          try {
            await db.query(
              'INSERT INTO users (id, phone, display_name, pin_hash, pin_salt, pin_iterations) VALUES ($1,$2,$3,$4,$5,$6)',
              [id, phone, DEFAULT_DISPLAY_NAME, hash, salt, iterations],
            )
          } catch {
            throw new HttpError(409, 'already_enrolled', 'Esta cuenta ya tiene un PIN.')
          }
          const token = createSessionToken(id, await sessionSecret(db), now())
          return send(res, 200, { profile: { phone: publicPhone(phone), displayName: DEFAULT_DISPLAY_NAME } }, {
            'Set-Cookie': sessionCookie(req, token, SESSION_TTL_SECONDS),
          })
        }

        case 'login': {
          const user = await currentUser(db)
          if (!user) return send(res, 200, { status: 'invalid', attemptsLeft: 0 })
          const locked = lockedUntilOf(user)
          if (locked !== null) return send(res, 200, { status: 'locked', retryAt: locked })
          const pin = typeof body.pin === 'string' ? body.pin : ''
          // Se cuenta el intento ANTES de verificar: varios intentos en paralelo no evitan el bloqueo.
          const [reserved] = await db.query(
            `UPDATE users SET failed_attempts = failed_attempts + 1
             WHERE id = $1 AND (locked_until IS NULL OR locked_until <= $2) RETURNING failed_attempts, lock_count`,
            [user.id, now()],
          )
          if (!reserved) return send(res, 200, { status: 'locked', retryAt: lockedUntilOf(await currentUser(db)) ?? now() })
          const candidate = PIN_REGEX.test(pin)
            ? await derivePin(pin, Buffer.from(String(user.pin_salt), 'base64'), Number(user.pin_iterations))
            : ''
          if (candidate !== '' && safeEqual(candidate, String(user.pin_hash))) {
            await db.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, lock_count = 0 WHERE id = $1', [user.id])
            const token = createSessionToken(String(user.id), await sessionSecret(db), now())
            return send(res, 200, { status: 'ok' }, { 'Set-Cookie': sessionCookie(req, token, SESSION_TTL_SECONDS) })
          }
          const failed = Number(reserved.failed_attempts)
          if (failed >= MAX_FREE_ATTEMPTS) {
            const lockCount = Number(reserved.lock_count) + 1
            const retryAt = now() + Math.min(BASE_LOCK_MS * 2 ** (lockCount - 1), MAX_LOCK_MS)
            await db.query('UPDATE users SET failed_attempts = 0, locked_until = $2, lock_count = $3 WHERE id = $1', [user.id, retryAt, lockCount])
            return send(res, 200, { status: 'locked', retryAt })
          }
          return send(res, 200, { status: 'invalid', attemptsLeft: MAX_FREE_ATTEMPTS - failed })
        }

        case 'logout':
          return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) })

        case 'list': {
          const userId = await requireUser(req, db)
          if (!isCollection(body.collection)) throw new HttpError(400, 'bad_request', 'Colección inválida.')
          const rows = await db.query(
            'SELECT data FROM documents WHERE user_id = $1 AND collection = $2 ORDER BY created_at, id',
            [userId, body.collection],
          )
          return send(res, 200, { items: rows.map((r) => r.data) })
        }

        case 'apply': {
          const userId = await requireUser(req, db)
          const ops = parseOps(body.ops)
          await db.batch(ops.map((op) => ({ text: UPSERT_SQL, params: [userId, op.collection, JSON.stringify(op.items)] })))
          return send(res, 200, { ok: true })
        }

        default:
          throw new HttpError(400, 'bad_request', 'Acción desconocida.')
      }
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.code, message: error.message })
      return send(res, 500, { error: 'server_error', message: 'Ocurrió un error en el servidor.' })
    }
  }
}

/* ── Función de Vercel ──────────────────────────────────────────────────── */

let production: Promise<Db | null> | null = null

export default createDwfHandler({
  getDb: () => {
    production ??= (async () => {
      const url = databaseUrl()
      return url ? neonDb(url) : null
    })()
    return production
  },
})
