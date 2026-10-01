import { DEFAULT_CATEGORIES, toIso } from '@/domain'
import type {
  Account,
  Category,
  InstallmentPayment,
  Loan,
  LoanBundle,
  LoanInstallment,
  ManualBalance,
  Reminder,
  SavingsContribution,
  SavingsJar,
  Transaction,
} from '@/domain'
import { COLLECTION_NAMES as C, type DocumentStore } from './documentStore'
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

class DocTransactionRepository implements TransactionRepository {
  constructor(private readonly store: DocumentStore) {}
  async list() {
    // Los movimientos anteriores al flujo completo no traían país/moneda/titular.
    return (await this.store.read<Transaction>(C.transactions)).map(withFlowDefaults)
  }
  async add(transaction: Transaction) {
    await this.store.apply([{ collection: C.transactions, items: [transaction] }])
  }
  async update(transactions: readonly Transaction[]) {
    await this.store.apply([{ collection: C.transactions, items: transactions }])
  }
}

class DocAccountRepository implements AccountRepository {
  constructor(private readonly store: DocumentStore) {}
  async list() {
    return this.store.read<Account>(C.accounts)
  }
  async ensureDefault(now: Date) {
    const existing = await this.store.read<Account>(C.accounts)
    if (existing.length > 0) return existing
    const timestamp = toIso(now)
    const account: Account = {
      id: DEFAULT_ACCOUNT_ID,
      name: 'Cuenta principal',
      currency: 'ARS',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.store.apply([{ collection: C.accounts, items: [account] }])
    return [account]
  }
}

class DocCategoryRepository implements CategoryRepository {
  constructor(private readonly store: DocumentStore) {}
  async list() {
    const stored = await this.store.read<Category>(C.categories)
    // Las categorías del sistema siempre se toman del catálogo vigente; las que
    // agregue el usuario en el futuro se conservan.
    const systemIds = new Set(DEFAULT_CATEGORIES.map((c) => c.id))
    const merged = [...DEFAULT_CATEGORIES, ...stored.filter((c) => !systemIds.has(c.id))]
    if (JSON.stringify(merged) !== JSON.stringify(stored)) {
      await this.store.apply([{ collection: C.categories, items: merged }])
    }
    return merged
  }
}

class DocReminderRepository implements ReminderRepository {
  constructor(private readonly store: DocumentStore) {}
  async list() {
    return this.store.read<Reminder>(C.reminders)
  }
  async add(reminder: Reminder) {
    await this.store.apply([{ collection: C.reminders, items: [reminder] }])
  }
  async update(reminder: Reminder) {
    await this.store.apply([{ collection: C.reminders, items: [reminder] }])
  }
}

class DocLoanRepository implements LoanRepository {
  constructor(private readonly store: DocumentStore) {}
  async listLoans() {
    return this.store.read<Loan>(C.loans)
  }
  async listInstallments() {
    return this.store.read<LoanInstallment>(C.installments)
  }
  async create({ loan, installments, transaction }: LoanBundle) {
    // Préstamo + cuotas + movimiento en una sola escritura atómica.
    await this.store.apply([
      { collection: C.transactions, items: [transaction] },
      { collection: C.installments, items: installments },
      { collection: C.loans, items: [loan] },
    ])
  }
  async recordPayment({ loan, installment, transaction }: InstallmentPayment) {
    await this.store.apply([
      { collection: C.transactions, items: [transaction] },
      { collection: C.installments, items: [installment] },
      { collection: C.loans, items: [loan] },
    ])
  }
}

class DocSavingsRepository implements SavingsRepository {
  constructor(private readonly store: DocumentStore) {}
  async listJars() {
    return this.store.read<SavingsJar>(C.savingsJars)
  }
  async listContributions() {
    return this.store.read<SavingsContribution>(C.savingsContributions)
  }
  async createJar(jar: SavingsJar) {
    await this.store.apply([{ collection: C.savingsJars, items: [jar] }])
  }
  async addContribution(contribution: SavingsContribution) {
    await this.store.apply([{ collection: C.savingsContributions, items: [contribution] }])
  }
}

class DocManualBalanceRepository implements ManualBalanceRepository {
  constructor(private readonly store: DocumentStore) {}
  async getUsd() {
    return (await this.store.read<ManualBalance>(C.manualBalances)).find((b) => b.currency === 'USD') ?? null
  }
  async setUsd(balance: ManualBalance) {
    await this.store.apply([{ collection: C.manualBalances, items: [balance] }])
  }
}

/** Todos los repositorios de la app sobre un mismo almacén (base de datos real o respaldo local). */
export function createRepositories(store: DocumentStore): Repositories {
  return {
    transactions: new DocTransactionRepository(store),
    accounts: new DocAccountRepository(store),
    categories: new DocCategoryRepository(store),
    reminders: new DocReminderRepository(store),
    loans: new DocLoanRepository(store),
    savings: new DocSavingsRepository(store),
    manualBalances: new DocManualBalanceRepository(store),
  }
}
