// Administración de la base de datos de DWF (local con PGlite, o producción con DATABASE_URL).
//
//   npm run db:migrate                       crea/actualiza el schema (también se hace solo al arrancar el backend)
//   npm run db:status                        cuántos datos hay en cada colección
//   npm run db:list -- <colección>           lista los datos de una colección (id y resumen)
//   npm run db:clean -- --yes                borra los datos cargados (movimientos, préstamos, cuotas, ahorros, dólares)
//   npm run db:delete -- <colección> <id> --yes   borra UN dato puntual (por ejemplo, un movimiento de prueba)
//   npm run db:reset-pin -- <PIN de 4 dígitos>    cambia el PIN de la cuenta sin tocar los datos
//
// Con DATABASE_URL (Neon) actúa sobre la base de producción; sin ella, sobre la base local (.data/pglite).
import { createInterface } from 'node:readline/promises'
import { COLLECTIONS, hashPin, migrate } from '../api/dwf.ts'
import { openDevDb } from '../server/devDb.ts'

const [command, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))

/** Datos que carga la persona (no incluye la cuenta ni las categorías). */
const USER_DATA = ['transactions', 'loans', 'loan-installments', 'savings-jars', 'savings-contributions', 'manual-balances']

const target = process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'PRODUCCIÓN (DATABASE_URL)' : 'base local (.data/pglite)'
const db = await openDevDb(process.env)

async function counts() {
  const rows = await db.query('SELECT collection, count(*)::int AS n FROM documents GROUP BY collection ORDER BY collection')
  const byName = Object.fromEntries(rows.map((r) => [String(r.collection), Number(r.n)]))
  return COLLECTIONS.map((name) => [name, byName[name] ?? 0])
}

async function confirm(question) {
  if (flags.has('--yes')) return true
  if (!process.stdin.isTTY) return false
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} (escribí "si" para continuar) `)
  rl.close()
  return answer.trim().toLowerCase() === 'si'
}

try {
  console.log(`Base: ${target}`)
  const applied = await migrate(db)
  if (applied.length) console.log(`Migraciones aplicadas: ${applied.join(', ')}`)

  if (command === 'migrate') {
    console.log('Schema al día.')
  } else if (command === 'status') {
    for (const [name, n] of await counts()) console.log(`${name.padEnd(24)} ${n}`)
    const users = await db.query('SELECT count(*)::int AS n FROM users')
    console.log(`${'cuentas (usuarios)'.padEnd(24)} ${users[0]?.n}`)
  } else if (command === 'list') {
    const [collection] = args
    if (!COLLECTIONS.includes(collection)) {
      console.error(`Uso: npm run db:list -- <colección>   (colecciones: ${COLLECTIONS.join(', ')})`)
      process.exitCode = 2
    } else {
      const rows = await db.query('SELECT id, data FROM documents WHERE collection = $1 ORDER BY created_at, id', [collection])
      for (const row of rows) console.log(`${row.id}  ${JSON.stringify(row.data).slice(0, 140)}`)
      console.log(`(${rows.length} ${collection})`)
    }
  } else if (command === 'clean') {
    if (!(await confirm(`Se van a borrar TODOS los datos cargados (${USER_DATA.join(', ')}) de ${target}.`))) {
      console.log('Cancelado: no se borró nada. (Agregá --yes para confirmar.)')
      process.exitCode = 1
    } else {
      await db.batch(USER_DATA.map((collection) => ({ text: 'DELETE FROM documents WHERE collection = $1', params: [collection] })))
      console.log('Datos borrados. Estado actual:')
      for (const [name, n] of await counts()) console.log(`${name.padEnd(24)} ${n}`)
    }
  } else if (command === 'delete') {
    const [collection, id] = args
    if (!COLLECTIONS.includes(collection) || !id) {
      console.error(`Uso: npm run db:delete -- <colección> <id> --yes   (colecciones: ${COLLECTIONS.join(', ')})`)
      process.exitCode = 2
    } else if (!(await confirm(`Se va a borrar ${collection}/${id} de ${target}.`))) {
      console.log('Cancelado: no se borró nada. (Agregá --yes para confirmar.)')
      process.exitCode = 1
    } else {
      const found = await db.query('DELETE FROM documents WHERE collection = $1 AND id = $2 RETURNING id', [collection, id])
      console.log(found.length ? `Borrado ${collection}/${id}.` : `No existe ${collection}/${id}: no se borró nada.`)
    }
  } else if (command === 'reset-pin') {
    const [pin] = args
    if (!/^\d{4}$/.test(pin ?? '')) {
      console.error('Uso: npm run db:reset-pin -- 1234   (4 dígitos)')
      process.exitCode = 2
    } else {
      const { hash, salt, iterations } = await hashPin(pin)
      const changed = await db.query(
        'UPDATE users SET pin_hash = $1, pin_salt = $2, pin_iterations = $3, failed_attempts = 0, locked_until = NULL, lock_count = 0 RETURNING id',
        [hash, salt, iterations],
      )
      console.log(changed.length ? 'PIN actualizado. Los datos no se tocaron.' : 'Todavía no hay cuenta: creala desde la app (primer ingreso).')
    }
  } else {
    console.log('Comandos: migrate | status | list <colección> | clean --yes | delete <colección> <id> --yes | reset-pin <PIN>')
    process.exitCode = command ? 2 : 0
  }
} finally {
  await db.close?.()
}
