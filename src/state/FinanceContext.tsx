import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  activeReminders,
  buildReminder,
  buildTransaction,
  cancelTransaction,
  computeBalance,
  latestTransactions,
  settleDueTransactions,
  sortByRecency,
  toIso,
  toLocalDate,
  validateNewReminder,
  validateNewTransaction,
  type Account,
  type Category,
  type CurrencyCode,
  type MinorUnits,
  type NewReminderInput,
  type NewTransactionInput,
  type Reminder,
  type ReminderErrors,
  type Result,
  type Transaction,
  type ValidationErrors,
} from '@/domain'
import { useServices } from './ServicesContext'

const SETTLE_INTERVAL_MS = 30_000
export const LATEST_TRANSACTIONS_LIMIT = 3

export type LoadStatus = 'loading' | 'ready' | 'error'
export type ActionError<F> = { fields?: F; message?: string }

interface FinanceContextValue {
  status: LoadStatus
  errorMessage: string | null
  reload(): void
  accounts: Account[]
  primaryAccount: Account | null
  categories: Category[]
  transactions: Transaction[]
  /** Todos los movimientos, más recientes primero (incluye programados/anulados). */
  history: Transaction[]
  /** Saldo en pesos (moneda del Home). */
  balance: MinorUnits
  /** Saldo derivado en la moneda pedida. */
  balanceOf(currency: CurrencyCode): MinorUnits
  latest: Transaction[]
  reminders: Reminder[]
  today: string
  addTransaction(input: Omit<NewTransactionInput, 'accountId'>): Promise<Result<Transaction, ActionError<ValidationErrors>>>
  cancelTransaction(id: string): Promise<void>
  addReminder(input: NewReminderInput): Promise<Result<Reminder, ActionError<ReminderErrors>>>
  dismissReminder(id: string): Promise<void>
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

const PERSIST_ERROR = 'No se pudo guardar. Revisá el espacio del dispositivo e intentá de nuevo.'

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { repositories, now, newId } = useServices()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [today, setToday] = useState(() => toLocalDate(now()))
  const [reloadKey, setReloadKey] = useState(0)
  const transactionsRef = useRef<Transaction[]>([])
  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const current = now()
        const [accountList, categoryList, storedTransactions, storedReminders] = await Promise.all([
          repositories.accounts.ensureDefault(current),
          repositories.categories.list(),
          repositories.transactions.list(),
          repositories.reminders.list(),
        ])
        const settled = settleDueTransactions(storedTransactions, current)
        if (settled.changed.length > 0) await repositories.transactions.update(settled.changed)
        if (cancelled) return
        setAccounts(accountList)
        setCategories(categoryList)
        setTransactions(settled.transactions)
        setReminders(storedReminders)
        setToday(toLocalDate(current))
        setErrorMessage(null)
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus datos.')
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [repositories, now, reloadKey])

  // Los movimientos programados pasan a COMPLETED cuando llega su momento.
  useEffect(() => {
    if (status !== 'ready') return
    const timer = setInterval(() => {
      const current = now()
      setToday(toLocalDate(current))
      const settled = settleDueTransactions(transactionsRef.current, current)
      if (settled.changed.length === 0) return
      void repositories.transactions.update(settled.changed).then(() => setTransactions(settled.transactions))
    }, SETTLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [status, repositories, now])

  const primaryAccount = accounts[0] ?? null

  const addTransaction = useCallback<FinanceContextValue['addTransaction']>(
    async (input) => {
      if (!primaryAccount) return { ok: false, error: { message: 'No hay una cuenta disponible.' } }
      const full: NewTransactionInput = { ...input, accountId: primaryAccount.id }
      const errors = validateNewTransaction(full, categories)
      if (Object.keys(errors).length > 0) return { ok: false, error: { fields: errors } }
      const transaction = buildTransaction(full, { id: newId(), now: now() })
      try {
        await repositories.transactions.add(transaction)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setTransactions((prev) => [...prev, transaction])
      return { ok: true, value: transaction }
    },
    [primaryAccount, categories, repositories, now, newId],
  )

  const cancel = useCallback(
    async (id: string) => {
      const target = transactionsRef.current.find((t) => t.id === id)
      if (!target) return
      const updated = cancelTransaction(target, now())
      await repositories.transactions.update([updated])
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
    },
    [repositories, now],
  )

  const addReminder = useCallback<FinanceContextValue['addReminder']>(
    async (input) => {
      const errors = validateNewReminder(input)
      if (Object.keys(errors).length > 0) return { ok: false, error: { fields: errors } }
      const reminder = buildReminder(input, { id: newId(), now: now() })
      try {
        await repositories.reminders.add(reminder)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setReminders((prev) => [...prev, reminder])
      return { ok: true, value: reminder }
    },
    [repositories, now, newId],
  )

  const dismissReminder = useCallback(
    async (id: string) => {
      const target = reminders.find((r) => r.id === id)
      if (!target) return
      const updated: Reminder = { ...target, status: 'DISMISSED', updatedAt: toIso(now()) }
      await repositories.reminders.update(updated)
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)))
    },
    [reminders, repositories, now],
  )

  const value = useMemo<FinanceContextValue>(
    () => ({
      status,
      errorMessage,
      reload: () => {
        setStatus('loading')
        setReloadKey((k) => k + 1)
      },
      accounts,
      primaryAccount,
      categories,
      transactions,
      history: sortByRecency(transactions),
      balance: computeBalance(transactions, undefined, 'ARS'),
      balanceOf: (currency: CurrencyCode) => computeBalance(transactions, undefined, currency),
      latest: latestTransactions(transactions, LATEST_TRANSACTIONS_LIMIT),
      reminders: activeReminders(reminders),
      today,
      addTransaction,
      cancelTransaction: cancel,
      addReminder,
      dismissReminder,
    }),
    [status, errorMessage, accounts, primaryAccount, categories, transactions, reminders, today, addTransaction, cancel, addReminder, dismissReminder],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de <FinanceProvider>')
  return ctx
}
