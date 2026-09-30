import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, buildReminder, buildTransaction, categoriesForType } from '@/domain'
import { createLocalRepositories, DEFAULT_ACCOUNT_ID, STORAGE_KEYS } from './localRepositories'
import { MemoryStorage, StorageCorruptedError } from './storage'

const NOW = new Date(2026, 9, 6, 12, 0)
const tx = (id: string) =>
  buildTransaction(
    { accountId: DEFAULT_ACCOUNT_ID, type: 'EXPENSE', amount: 500, description: id, categoryId: 'cat-expense-food', date: '2026-10-06', time: '10:00' },
    { id, now: NOW },
  )

describe('repositorios locales', () => {
  it('persisten y recuperan movimientos entre instancias', async () => {
    const storage = new MemoryStorage()
    await createLocalRepositories(storage).transactions.add(tx('a'))
    const again = createLocalRepositories(storage)
    expect((await again.transactions.list()).map((t) => t.id)).toEqual(['a'])
  })

  it('update reemplaza por id sin duplicar ni borrar', async () => {
    const repos = createLocalRepositories(new MemoryStorage())
    await repos.transactions.add(tx('a'))
    await repos.transactions.add(tx('b'))
    await repos.transactions.update([{ ...tx('a'), status: 'CANCELLED' }])
    const list = await repos.transactions.list()
    expect(list).toHaveLength(2)
    expect(list.find((t) => t.id === 'a')?.status).toBe('CANCELLED')
  })

  it('no expone borrado físico', () => {
    const repos = createLocalRepositories(new MemoryStorage())
    for (const repo of [repos.transactions, repos.reminders, repos.accounts, repos.categories]) {
      expect(repo).not.toHaveProperty('delete')
      expect(repo).not.toHaveProperty('remove')
    }
  })

  it('crea la cuenta principal una sola vez', async () => {
    const repos = createLocalRepositories(new MemoryStorage())
    const first = await repos.accounts.ensureDefault(NOW)
    const second = await repos.accounts.ensureDefault(new Date())
    expect(first).toHaveLength(1)
    expect(second).toEqual(first)
    expect(first[0]).toMatchObject({ id: DEFAULT_ACCOUNT_ID, currency: 'ARS' })
  })

  it('siembra categorías del sistema', async () => {
    const list = await createLocalRepositories(new MemoryStorage()).categories.list()
    expect(list).toHaveLength(DEFAULT_CATEGORIES.length)
  })

  it('guarda recordatorios', async () => {
    const repos = createLocalRepositories(new MemoryStorage())
    const r = buildReminder({ title: 'Cuota', description: '', dueDate: '2026-10-06' }, { id: 'r1', now: NOW })
    await repos.reminders.add(r)
    await repos.reminders.update({ ...r, status: 'DISMISSED' })
    expect(await repos.reminders.list()).toEqual([{ ...r, status: 'DISMISSED' }])
  })

  it('no pisa datos dañados: informa el error', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.transactions, '{no-json')
    const repos = createLocalRepositories(storage)
    await expect(repos.transactions.list()).rejects.toBeInstanceOf(StorageCorruptedError)
    await expect(repos.transactions.add(tx('a'))).rejects.toBeInstanceOf(StorageCorruptedError)
    expect(storage.getItem(STORAGE_KEYS.transactions)).toBe('{no-json')
  })
})

describe('compatibilidad con datos de la primera versión', () => {
  it('completa país, moneda, titular y tipo de operación en movimientos viejos', async () => {
    const storage = new MemoryStorage()
    const legacy = { ...tx('old') } as Partial<ReturnType<typeof tx>>
    delete legacy.country
    delete legacy.currency
    delete legacy.holder
    delete legacy.paymentMethod
    storage.setItem(STORAGE_KEYS.transactions, JSON.stringify({ version: 1, items: [legacy] }))
    const [loaded] = await createLocalRepositories(storage).transactions.list()
    expect(loaded).toMatchObject({ country: 'AR', currency: 'ARS', holder: 'INDIVIDUAL', paymentMethod: null })
  })

  it('las categorías del sistema se actualizan y las viejas quedan retiradas', async () => {
    const storage = new MemoryStorage()
    storage.setItem(
      STORAGE_KEYS.categories,
      JSON.stringify({ version: 1, items: [{ id: 'cat-expense-food', name: 'Comida', type: 'EXPENSE', system: true }] }),
    )
    const list = await createLocalRepositories(storage).categories.list()
    expect(list.find((c) => c.id === 'cat-expense-food')?.retired).toBe(true)
    expect(list.find((c) => c.id === 'inc-employment')?.name).toBe('Trabajo en relación de dependencia')
    expect(categoriesForType(list, 'EXPENSE').map((c) => c.name)).toEqual([
      'Transporte y movilidad',
      'Salidas y ocio',
      'Préstamos',
      'Cuidado personal y compras',
      'Suscripciones y tecnología',
    ])
    expect(categoriesForType(list, 'INCOME')).toHaveLength(5)
  })
})
