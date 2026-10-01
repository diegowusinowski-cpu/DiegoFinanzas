import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  activeReminders,
  buildContribution,
  buildInstallmentPayment,
  buildJar,
  buildLoanBundle,
  buildReminder,
  buildTransaction,
  cancelTransaction,
  computeBalance,
  latestTransactions,
  savingsTotals,
  settleDueTransactions,
  sortJars,
  sortByRecency,
  sortLoans,
  toIso,
  toLocalDate,
  validateContribution,
  validateNewJar,
  validateNewLoan,
  validateNewReminder,
  validateNewTransaction,
  type Account,
  type Category,
  type CurrencyCode,
  type InstallmentPayment,
  type JarErrors,
  type Loan,
  type LoanBundle,
  type LoanErrors,
  type LoanInstallment,
  type NewJarInput,
  type NewLoanInput,
  type MinorUnits,
  type NewReminderInput,
  type NewTransactionInput,
  type Reminder,
  type ReminderErrors,
  type Result,
  type SavingsContribution,
  type SavingsJar,
  type SavingsTotals,
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
  /** Préstamos (más recientes primero) y todas sus cuotas. */
  loans: Loan[]
  installments: LoanInstallment[]
  /**
   * Crea el préstamo, sus cuotas y el movimiento GASTO por el monto prestado,
   * todo de una vez. El interés no es un movimiento.
   */
  createLoan(input: Omit<NewLoanInput, 'accountId'>): Promise<Result<LoanBundle, ActionError<LoanErrors>>>
  /**
   * Marca una cuota como pagada: registra el INGRESO por su importe (sube el saldo), actualiza el
   * avance del préstamo y lo completa si era la última.
   */
  payInstallment(installmentId: string): Promise<Result<InstallmentPayment, ActionError<never>>>
  /** Frascos de ahorro (más recientes primero) y todos sus aportes. */
  jars: SavingsJar[]
  contributions: SavingsContribution[]
  /** Saldo total, dinero asignado a frascos y disponible. Ahorrar no cambia el saldo total. */
  savings: SavingsTotals
  createJar(input: NewJarInput): Promise<Result<SavingsJar, ActionError<JarErrors>>>
  /**
   * Reserva dinero en un frasco. Es una asignación interna: no crea movimientos ni modifica el saldo;
   * solo baja el dinero disponible.
   */
  addToJar(jarId: string, amount: MinorUnits): Promise<Result<SavingsContribution, ActionError<never>>>
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
  const [loans, setLoans] = useState<Loan[]>([])
  const [installments, setInstallments] = useState<LoanInstallment[]>([])
  const [jars, setJars] = useState<SavingsJar[]>([])
  const [contributions, setContributions] = useState<SavingsContribution[]>([])
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
        const [accountList, categoryList, storedTransactions, storedReminders, storedLoans, storedInstallments, storedJars, storedContributions] =
          await Promise.all([
          repositories.accounts.ensureDefault(current),
          repositories.categories.list(),
          repositories.transactions.list(),
          repositories.reminders.list(),
          repositories.loans.listLoans(),
          repositories.loans.listInstallments(),
          repositories.savings.listJars(),
          repositories.savings.listContributions(),
        ])
        const settled = settleDueTransactions(storedTransactions, current)
        if (settled.changed.length > 0) await repositories.transactions.update(settled.changed)
        if (cancelled) return
        setAccounts(accountList)
        setCategories(categoryList)
        setTransactions(settled.transactions)
        setReminders(storedReminders)
        setLoans(storedLoans)
        setInstallments(storedInstallments)
        setJars(storedJars)
        setContributions(storedContributions)
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

  const createLoan = useCallback<FinanceContextValue['createLoan']>(
    async (input) => {
      if (!primaryAccount) return { ok: false, error: { message: 'No hay una cuenta disponible.' } }
      const full: NewLoanInput = { ...input, accountId: primaryAccount.id }
      const errors = validateNewLoan(full)
      if (Object.keys(errors).length > 0) return { ok: false, error: { fields: errors } }
      const bundle = buildLoanBundle(full, { now: now(), newId })
      if (Object.keys(validateNewTransaction(bundle.transaction, categories)).length > 0) {
        return { ok: false, error: { message: 'No se pudo registrar el movimiento del préstamo.' } }
      }
      try {
        await repositories.loans.create(bundle)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setTransactions((prev) => [...prev, bundle.transaction])
      setLoans((prev) => [...prev, bundle.loan])
      setInstallments((prev) => [...prev, ...bundle.installments])
      return { ok: true, value: bundle }
    },
    [primaryAccount, categories, repositories, now, newId],
  )

  const payInstallment = useCallback<FinanceContextValue['payInstallment']>(
    async (installmentId) => {
      if (!primaryAccount) return { ok: false, error: { message: 'No hay una cuenta disponible.' } }
      const installment = installments.find((i) => i.id === installmentId)
      const loan = installment ? loans.find((l) => l.id === installment.loanId) : undefined
      if (!installment || !loan) return { ok: false, error: { message: 'No encontramos esa cuota.' } }
      const built = buildInstallmentPayment(
        loan,
        installment,
        installments.filter((i) => i.loanId === loan.id),
        { now: now(), newId, accountId: primaryAccount.id },
      )
      if (!built.ok) {
        return { ok: false, error: { message: built.error === 'ALREADY_PAID' ? 'Esa cuota ya está pagada.' : 'No encontramos esa cuota.' } }
      }
      const payment = built.value
      try {
        await repositories.loans.recordPayment(payment)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setTransactions((prev) => [...prev, payment.transaction])
      setLoans((prev) => prev.map((l) => (l.id === payment.loan.id ? payment.loan : l)))
      setInstallments((prev) => prev.map((i) => (i.id === payment.installment.id ? payment.installment : i)))
      return { ok: true, value: payment }
    },
    [primaryAccount, installments, loans, repositories, now, newId],
  )

  const createJar = useCallback<FinanceContextValue['createJar']>(
    async (input) => {
      const errors = validateNewJar(input, toLocalDate(now()))
      if (Object.keys(errors).length > 0) return { ok: false, error: { fields: errors } }
      const jar = buildJar(input, { now: now(), newId })
      try {
        await repositories.savings.createJar(jar)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setJars((prev) => [...prev, jar])
      return { ok: true, value: jar }
    },
    [repositories, now, newId],
  )

  const addToJar = useCallback<FinanceContextValue['addToJar']>(
    async (jarId, amount) => {
      const jar = jars.find((j) => j.id === jarId)
      if (!jar) return { ok: false, error: { message: 'No encontramos ese frasco.' } }
      const { available } = savingsTotals(computeBalance(transactionsRef.current, undefined, 'ARS'), jars, contributions)
      const problem = validateContribution(amount, available)
      if (problem === 'INVALID_AMOUNT') return { ok: false, error: { message: 'Ingresá un monto mayor a cero.' } }
      if (problem === 'NOT_ENOUGH_AVAILABLE') {
        return { ok: false, error: { message: 'No tenés tanto dinero disponible sin asignar.' } }
      }
      const contribution = buildContribution(jar, amount, { now: now(), newId })
      try {
        await repositories.savings.addContribution(contribution)
      } catch {
        return { ok: false, error: { message: PERSIST_ERROR } }
      }
      setContributions((prev) => [...prev, contribution])
      return { ok: true, value: contribution }
    },
    [jars, contributions, repositories, now, newId],
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
      loans: sortLoans(loans),
      installments,
      createLoan,
      payInstallment,
      jars: sortJars(jars),
      contributions,
      savings: savingsTotals(computeBalance(transactions, undefined, 'ARS'), jars, contributions),
      createJar,
      addToJar,
    }),
    [status, errorMessage, accounts, primaryAccount, categories, transactions, reminders, today, addTransaction, cancel, addReminder, dismissReminder, loans, installments, createLoan, payInstallment, jars, contributions, createJar, addToJar],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de <FinanceProvider>')
  return ctx
}
