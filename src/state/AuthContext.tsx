import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile } from '@/domain'
import type { VerifyResult } from '@/services/auth'
import { useServices } from './ServicesContext'

const SESSION_KEY = 'dwf.session'

export type AuthStatus = 'loading' | 'setup' | 'locked' | 'unlocked' | 'unavailable'

interface AuthContextValue {
  status: AuthStatus
  /** Por qué no se pudo conectar (solo con `status === 'unavailable'`). */
  errorMessage: string | null
  profile: Profile | null
  unlock(pin: string): Promise<VerifyResult>
  enroll(phone: string, pin: string): Promise<void>
  lock(): void
  resetAccess(): Promise<void>
  getLockedUntil(): Promise<number | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth, session } = useServices()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void auth.getProfile().then(
      (found) => {
        if (cancelled) return
        setProfile(found)
        if (!found) setStatus('setup')
        else setStatus(session.getItem(SESSION_KEY) === '1' ? 'unlocked' : 'locked')
      },
      (error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.')
        setStatus('unavailable')
      },
    )
    return () => {
      cancelled = true
    }
  }, [auth, session])

  const unlock = useCallback(
    async (pin: string) => {
      const result = await auth.verifyPin(pin)
      if (result.status === 'ok') {
        session.setItem(SESSION_KEY, '1')
        setStatus('unlocked')
      }
      return result
    },
    [auth, session],
  )

  const enroll = useCallback(
    async (phone: string, pin: string) => {
      const created = await auth.enroll({ phone, pin })
      setProfile(created)
      session.setItem(SESSION_KEY, '1')
      setStatus('unlocked')
    },
    [auth, session],
  )

  const lock = useCallback(() => {
    session.removeItem(SESSION_KEY)
    void auth.signOut?.()
    setStatus('locked')
  }, [auth, session])

  const resetAccess = useCallback(async () => {
    await auth.resetAccess()
    session.removeItem(SESSION_KEY)
    setProfile(null)
    setStatus('setup')
  }, [auth, session])

  const getLockedUntil = useCallback(() => auth.getLockedUntil(), [auth])

  const value = useMemo(
    () => ({ status, errorMessage, profile, unlock, enroll, lock, resetAccess, getLockedUntil }),
    [status, errorMessage, profile, unlock, enroll, lock, resetAccess, getLockedUntil],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
