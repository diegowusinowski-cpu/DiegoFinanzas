import { DEFAULT_CATEGORIES, toIso } from '@/domain'
import type { Account, Category, Reminder, Transaction } from '@/domain'
import { LocalCollection } from './localCollection'
import type {
  AccountRepository,
  CategoryRepository,
  ReminderRepository,
  Repositories,
  TransactionRepository,
} from './repositories'
import type { KeyValueStorage } from './storage'

export const STORAGE_KEYS = {
  transactions: 'dwf.v1.transactions',
  accounts: 'dwf.v1.accounts',
  categories: 'dwf.v1.categories',
  reminders: 'dwf.v1.reminders',
} as const

export const DEFAULT_ACCOUNT_ID = 'acc-main'

/** Completa los campos agregados después de la primera versión (siempre ARS / Argentina / Individual). */
function withFlowDefaults(t: Transaction): Transaction {
  return {
    ...t,
    country: t.country ?? 'AR',
    currency: t.currency ?? 'ARS',
    holder: t.holder ?? 'INDIVIDUAL',
    paymentMethod: t.paymentMethod ?? null,
  }
}

class LocalTransactionRepository implements TransactionRepository {
  private readonly collection: LocalCollection<Transaction>
  constructor(storage: KeyValueStorage) {
    this.collection = new LocalCollection(storage, STORAGE_KEYS.transactions)
  }
  async list() {
    // Los movimientos anteriores al flujo completo no traían país/moneda/titular.
    return this.collection.read().map(withFlowDefaults)
  }
  async add(transaction: Transaction) {
    this.collection.upsertMany([transaction])
  }
  async update(transactions: readonly Transaction[]) {
    this.collection.upsertMany(transactions)
  }
}

class LocalAccountRepository implements AccountRepository {
  private readonly collection: LocalCollection<Account>
  constructor(storage: KeyValueStorage) {
    this.collection = new LocalCollection(storage, STORAGE_KEYS.accounts)
  }
  async list() {
    return this.collection.read()
  }
  async ensureDefault(now: Date) {
    const existing = this.collection.read()
    if (existing.length > 0) return existing
    const timestamp = toIso(now)
    const account: Account = {
      id: DEFAULT_ACCOUNT_ID,
      name: 'Cuenta principal',
      currency: 'ARS',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.collection.write([account])
    return [account]
  }
}

class LocalCategoryRepository implements CategoryRepository {
  private readonly collection: LocalCollection<Category>
  constructor(storage: KeyValueStorage) {
    this.collection = new LocalCollection(storage, STORAGE_KEYS.categories)
  }
  async list() {
    const stored = this.collection.read()
    // Las categorías del sistema siempre se toman del catálogo vigente; las que
    // agregue el usuario en el futuro se conservan.
    const systemIds = new Set(DEFAULT_CATEGORIES.map((c) => c.id))
    const merged = [...DEFAULT_CATEGORIES, ...stored.filter((c) => !systemIds.has(c.id))]
    if (JSON.stringify(merged) !== JSON.stringify(stored)) this.collection.write(merged)
    return merged
  }
}

class LocalReminderRepository implements ReminderRepository {
  private readonly collection: LocalCollection<Reminder>
  constructor(storage: KeyValueStorage) {
    this.collection = new LocalCollection(storage, STORAGE_KEYS.reminders)
  }
  async list() {
    return this.collection.read()
  }
  async add(reminder: Reminder) {
    this.collection.upsertMany([reminder])
  }
  async update(reminder: Reminder) {
    this.collection.upsertMany([reminder])
  }
}

export function createLocalRepositories(storage: KeyValueStorage): Repositories {
  return {
    transactions: new LocalTransactionRepository(storage),
    accounts: new LocalAccountRepository(storage),
    categories: new LocalCategoryRepository(storage),
    reminders: new LocalReminderRepository(storage),
  }
}
