import { DEFAULT_CATEGORIES, toIso } from '@/domain'
import type { Account, Category, InstallmentPayment, Loan, ManualBalance, SavingsContribution, SavingsJar, LoanBundle, LoanInstallment, Reminder, Transaction } from '@/domain'
import { LocalCollection } from './localCollection'
import type {
  AccountRepository,
  CategoryRepository,
  LoanRepository,
  ManualBalanceRepository,
  ReminderRepository,
  Repositories,
  SavingsRepository,
  TransactionRepository,
} from './repositories'
import type { KeyValueStorage } from './storage'

export const STORAGE_KEYS = {
  transactions: 'dwf.v1.transactions',
  accounts: 'dwf.v1.accounts',
  categories: 'dwf.v1.categories',
  reminders: 'dwf.v1.reminders',
  loans: 'dwf.v1.loans',
  installments: 'dwf.v1.loan-installments',
  savingsJars: 'dwf.v1.savings-jars',
  savingsContributions: 'dwf.v1.savings-contributions',
  manualBalances: 'dwf.v1.manual-balances',
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
    loanId: t.loanId ?? null,
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

class LocalLoanRepository implements LoanRepository {
  private readonly loans: LocalCollection<Loan>
  private readonly installments: LocalCollection<LoanInstallment>
  private readonly transactions: LocalCollection<Transaction>
  constructor(private readonly storage: KeyValueStorage) {
    this.loans = new LocalCollection(storage, STORAGE_KEYS.loans)
    this.installments = new LocalCollection(storage, STORAGE_KEYS.installments)
    this.transactions = new LocalCollection(storage, STORAGE_KEYS.transactions)
  }
  async listLoans() {
    return this.loans.read()
  }
  async listInstallments() {
    return this.installments.read()
  }
  async create({ loan, installments, transaction }: LoanBundle) {
    this.atomically(() => {
      this.transactions.upsertMany([transaction])
      this.installments.upsertMany(installments)
      this.loans.upsertMany([loan])
    })
  }
  async recordPayment({ loan, installment, transaction }: InstallmentPayment) {
    this.atomically(() => {
      this.transactions.upsertMany([transaction])
      this.installments.upsertMany([installment])
      this.loans.upsertMany([loan])
    })
  }
  /** Todo o nada: si algo falla, se restaura el estado previo de las tres colecciones. */
  private atomically(write: () => void) {
    const keys = [STORAGE_KEYS.loans, STORAGE_KEYS.installments, STORAGE_KEYS.transactions]
    const snapshot = keys.map((key) => [key, this.storage.getItem(key)] as const)
    try {
      write()
    } catch (error) {
      for (const [key, raw] of snapshot) {
        // Cada colección se restaura por separado: que una falle no impide restaurar las demás.
        try {
          if (raw === null) this.storage.removeItem(key)
          else this.storage.setItem(key, raw)
        } catch {
          continue
        }
      }
      throw error
    }
  }
}

class LocalSavingsRepository implements SavingsRepository {
  private readonly jars: LocalCollection<SavingsJar>
  private readonly contributions: LocalCollection<SavingsContribution>
  constructor(storage: KeyValueStorage) {
    this.jars = new LocalCollection(storage, STORAGE_KEYS.savingsJars)
    this.contributions = new LocalCollection(storage, STORAGE_KEYS.savingsContributions)
  }
  async listJars() {
    return this.jars.read()
  }
  async listContributions() {
    return this.contributions.read()
  }
  async createJar(jar: SavingsJar) {
    this.jars.upsertMany([jar])
  }
  async addContribution(contribution: SavingsContribution) {
    this.contributions.upsertMany([contribution])
  }
}

class LocalManualBalanceRepository implements ManualBalanceRepository {
  private readonly collection: LocalCollection<ManualBalance>
  constructor(storage: KeyValueStorage) {
    this.collection = new LocalCollection(storage, STORAGE_KEYS.manualBalances)
  }
  async getUsd() {
    return this.collection.read().find((b) => b.currency === 'USD') ?? null
  }
  async setUsd(balance: ManualBalance) {
    this.collection.upsertMany([balance])
  }
}

export function createLocalRepositories(storage: KeyValueStorage): Repositories {
  return {
    transactions: new LocalTransactionRepository(storage),
    accounts: new LocalAccountRepository(storage),
    categories: new LocalCategoryRepository(storage),
    reminders: new LocalReminderRepository(storage),
    loans: new LocalLoanRepository(storage),
    savings: new LocalSavingsRepository(storage),
    manualBalances: new LocalManualBalanceRepository(storage),
  }
}
