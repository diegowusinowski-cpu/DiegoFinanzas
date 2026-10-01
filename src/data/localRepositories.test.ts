import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  buildInstallmentPayment,
  buildJar,
  buildLoanBundle,
  buildReminder,
  buildTransaction,
  categoriesForType,
  type InstallmentPayment,
  type SavingsContribution,
} from '@/domain'
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

describe('préstamos: persistencia atómica', () => {
  const bundle = () =>
    buildLoanBundle(
      { accountId: 'acc-main', borrowerName: 'Ana', principalAmount: 1_000_000, installmentCount: 4, loanDate: '2026-10-02', dueDate: '2026-12-02' },
      { now: NOW, newId: (() => { let n = 0; return () => `l-${++n}` })() },
    )

  it('guarda préstamo, cuotas y movimiento juntos y los recupera', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    const b = bundle()
    await repos.loans.create(b)
    const again = createLocalRepositories(storage)
    expect(await again.loans.listLoans()).toEqual([b.loan])
    expect(await again.loans.listInstallments()).toHaveLength(4)
    expect((await again.transactions.list()).map((t) => t.id)).toEqual([b.transaction.id])
  })

  it('si falla en medio, no queda nada a medias (todo o nada)', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    await repos.transactions.add(tx('previo'))
    const failing = {
      getItem: (k: string) => storage.getItem(k),
      removeItem: (k: string) => storage.removeItem(k),
      setItem: (k: string, v: string) => {
        if (k === STORAGE_KEYS.loans) throw new Error('cuota de almacenamiento')
        storage.setItem(k, v)
      },
    }
    await expect(createLocalRepositories(failing).loans.create(bundle())).rejects.toThrow()
    const check = createLocalRepositories(storage)
    expect(await check.loans.listLoans()).toEqual([])
    expect(await check.loans.listInstallments()).toEqual([])
    expect((await check.transactions.list()).map((t) => t.id)).toEqual(['previo']) // sin el gasto del préstamo
  })

  const payment = (b: ReturnType<typeof bundle>): InstallmentPayment => {
    const result = buildInstallmentPayment(b.loan, b.installments[0]!, b.installments, {
      now: new Date(2026, 10, 7, 9, 0),
      newId: () => 'pago',
      accountId: 'acc-main',
    })
    if (!result.ok) throw new Error('debió cobrar')
    return result.value
  }

  it('recordPayment guarda cuota, préstamo e ingreso juntos', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    const b = bundle()
    await repos.loans.create(b)
    await repos.loans.recordPayment(payment(b))
    const again = createLocalRepositories(storage)
    const installments = await again.loans.listInstallments()
    expect(installments.filter((i) => i.status === 'PAID').map((i) => i.installmentNumber)).toEqual([1])
    expect((await again.transactions.list()).map((t) => t.id).sort()).toEqual([b.transaction.id, 'pago'].sort())
  })

  it('si el cobro falla en medio, la cuota sigue pendiente y no hay ingreso', async () => {
    const storage = new MemoryStorage()
    const b = bundle()
    await createLocalRepositories(storage).loans.create(b)
    const failing = {
      getItem: (k: string) => storage.getItem(k),
      removeItem: (k: string) => storage.removeItem(k),
      setItem: (k: string, v: string) => {
        if (k === STORAGE_KEYS.loans) throw new Error('cuota de almacenamiento')
        storage.setItem(k, v)
      },
    }
    await expect(createLocalRepositories(failing).loans.recordPayment(payment(b))).rejects.toThrow()
    const check = createLocalRepositories(storage)
    // El préstamo no se pudo reescribir, pero cuotas e ingresos se restauran.
    expect((await check.loans.listInstallments()).every((i) => i.status === 'PENDING')).toBe(true)
    expect((await check.transactions.list()).map((t) => t.id)).toEqual([b.transaction.id])
  })

  it('no expone borrado', () => {
    expect(createLocalRepositories(new MemoryStorage()).loans).not.toHaveProperty('delete')
  })
})

describe('ahorros: persistencia', () => {
  const jar = (id: string) =>
    buildJar(
      { name: id, targetAmount: 1_000_000, targetDate: null, plan: { frequency: 'WEEKLY', amount: 50_000 } },
      { now: NOW, newId: () => id },
    )
  const contribution = (id: string, jarId: string, amount: number): SavingsContribution => ({
    id,
    jarId,
    amount,
    date: '2026-10-06',
    createdAt: NOW.toISOString(),
  })

  it('guarda varios frascos y aportes y los recupera entre instancias', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    await repos.savings.createJar(jar('a'))
    await repos.savings.createJar(jar('b'))
    await repos.savings.addContribution(contribution('c1', 'a', 100))
    await repos.savings.addContribution(contribution('c2', 'a', 200))
    await repos.savings.addContribution(contribution('c3', 'b', 300))
    const again = createLocalRepositories(storage)
    expect((await again.savings.listJars()).map((j) => j.id)).toEqual(['a', 'b'])
    expect((await again.savings.listContributions()).map((c) => [c.id, c.amount])).toEqual([
      ['c1', 100],
      ['c2', 200],
      ['c3', 300],
    ])
  })

  it('agregar aportes no toca movimientos (no es gasto) y no sobrescribe los anteriores', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    await repos.transactions.add(tx('previo'))
    await repos.savings.createJar(jar('a'))
    await repos.savings.addContribution(contribution('c1', 'a', 100))
    await repos.savings.addContribution(contribution('c2', 'a', 100))
    expect((await repos.transactions.list()).map((t) => t.id)).toEqual(['previo'])
    expect(await repos.savings.listContributions()).toHaveLength(2)
  })

  it('no expone edición ni borrado de aportes', () => {
    const { savings } = createLocalRepositories(new MemoryStorage())
    expect(savings).not.toHaveProperty('delete')
    expect(savings).not.toHaveProperty('deleteContribution')
    expect(savings).not.toHaveProperty('updateContribution')
  })
})

describe('saldo manual en dólares: persistencia', () => {
  const usd = (amount: number) => ({ id: 'usd-balance', currency: 'USD' as const, amount, updatedAt: NOW.toISOString() })

  it('sin nada guardado no hay saldo', async () => {
    expect(await createLocalRepositories(new MemoryStorage()).manualBalances.getUsd()).toBeNull()
  })

  it('guarda el saldo y lo recupera en otra instancia; editar lo reemplaza (un solo valor)', async () => {
    const storage = new MemoryStorage()
    await createLocalRepositories(storage).manualBalances.setUsd(usd(100_000))
    expect((await createLocalRepositories(storage).manualBalances.getUsd())?.amount).toBe(100_000)
    await createLocalRepositories(storage).manualBalances.setUsd(usd(250_050))
    const again = createLocalRepositories(storage)
    expect((await again.manualBalances.getUsd())?.amount).toBe(250_050)
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.manualBalances) ?? '{}').items).toHaveLength(1)
  })

  it('no es un movimiento: no toca las transacciones', async () => {
    const storage = new MemoryStorage()
    const repos = createLocalRepositories(storage)
    await repos.transactions.add(tx('previo'))
    await repos.manualBalances.setUsd(usd(100_000))
    expect((await repos.transactions.list()).map((t) => t.id)).toEqual(['previo'])
  })
})
