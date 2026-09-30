import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, buildReminder, buildTransaction } from '@/domain'
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
