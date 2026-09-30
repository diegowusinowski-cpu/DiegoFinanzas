import { beforeAll, describe, expect, it } from 'vitest'
import { MemoryStorage } from '@/data/storage'
import { LocalPinAuthService } from './localPinAuth'
import { isValidPin, maskPhone, normalizePhone } from './auth'

beforeAll(() => {
  expect(globalThis.crypto?.subtle).toBeDefined()
})

const setup = () => {
  const storage = new MemoryStorage()
  let clock = 1_000_000
  const auth = new LocalPinAuthService(storage, () => clock)
  return { storage, auth, advance: (ms: number) => (clock += ms) }
}

describe('LocalPinAuthService', () => {
  it('no guarda el PIN en texto plano', async () => {
    const { auth, storage } = setup()
    await auth.enroll({ phone: '11 2345 6789', pin: '4821' })
    const raw = storage.getItem('dwf.v1.auth') ?? ''
    expect(raw).not.toContain('4821')
    const stored = JSON.parse(raw)
    expect(stored.hash).toMatch(/^[A-Za-z0-9+/=]{40,}$/)
    expect(stored.salt).toBeTruthy()
    expect(stored.iterations).toBeGreaterThanOrEqual(100_000)
  })

  it('usa una sal distinta por alta', async () => {
    const a = setup()
    const b = setup()
    await a.auth.enroll({ phone: '1123456789', pin: '1234' })
    await b.auth.enroll({ phone: '1123456789', pin: '1234' })
    const read = (s: MemoryStorage) => JSON.parse(s.getItem('dwf.v1.auth')!)
    expect(read(a.storage).hash).not.toBe(read(b.storage).hash)
  })

  it('normaliza el teléfono y expone el perfil', async () => {
    const { auth } = setup()
    const profile = await auth.enroll({ phone: '11 2345-6789', pin: '1234' })
    expect(profile).toEqual({ phone: '+5491123456789', displayName: 'Diego' })
    expect(await auth.getProfile()).toEqual(profile)
  })

  it('rechaza teléfonos y PIN inválidos', async () => {
    const { auth } = setup()
    await expect(auth.enroll({ phone: '123', pin: '1234' })).rejects.toThrow(/teléfono/)
    await expect(auth.enroll({ phone: '1123456789', pin: '12' })).rejects.toThrow(/4 dígitos/)
    await expect(auth.enroll({ phone: '1123456789', pin: 'abcd' })).rejects.toThrow(/4 dígitos/)
  })

  it('acepta el PIN correcto y rechaza el incorrecto', async () => {
    const { auth } = setup()
    await auth.enroll({ phone: '1123456789', pin: '1234' })
    expect(await auth.verifyPin('1234')).toEqual({ status: 'ok' })
    expect(await auth.verifyPin('0000')).toEqual({ status: 'invalid', attemptsLeft: 4 })
  })

  it('bloquea tras 5 fallos y se libera con el tiempo', async () => {
    const { auth, advance } = setup()
    await auth.enroll({ phone: '1123456789', pin: '1234' })
    for (let i = 0; i < 4; i++) await auth.verifyPin('9999')
    const locked = await auth.verifyPin('9999')
    expect(locked.status).toBe('locked')
    // Estando bloqueado, ni el PIN correcto entra.
    expect((await auth.verifyPin('1234')).status).toBe('locked')
    expect(await auth.getLockedUntil()).not.toBeNull()
    advance(31_000)
    expect(await auth.getLockedUntil()).toBeNull()
    expect(await auth.verifyPin('1234')).toEqual({ status: 'ok' })
  })

  it('el bloqueo se duplica en reincidencias', async () => {
    const { auth, advance } = setup()
    await auth.enroll({ phone: '1123456789', pin: '1234' })
    const lock = async () => {
      let r = await auth.verifyPin('9999')
      for (let i = 0; i < 4 && r.status !== 'locked'; i++) r = await auth.verifyPin('9999')
      return r
    }
    const first = await lock()
    advance(31_000)
    const second = await lock()
    if (first.status !== 'locked' || second.status !== 'locked') throw new Error('debía bloquear')
    expect(second.retryAt - first.retryAt).toBeGreaterThan(30_000)
  })

  it('resetAccess borra credenciales', async () => {
    const { auth } = setup()
    await auth.enroll({ phone: '1123456789', pin: '1234' })
    await auth.resetAccess()
    expect(await auth.getProfile()).toBeNull()
  })

  it('ignora datos de credenciales corruptos', async () => {
    const { auth, storage } = setup()
    storage.setItem('dwf.v1.auth', '{roto')
    expect(await auth.getProfile()).toBeNull()
  })
})

describe('helpers de acceso', () => {
  it('valida PIN', () => {
    expect(isValidPin('0123')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })

  it('normaliza teléfonos', () => {
    expect(normalizePhone('+54 9 11 2345-6789')).toBe('+5491123456789')
    expect(normalizePhone('011 2345 6789')).toBe('+5491123456789')
    expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671')
    expect(normalizePhone('abc')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
  })

  it('oculta parcialmente el teléfono', () => {
    const masked = maskPhone('+5491123456789')
    expect(masked).toBe('+54 •••••••• 789')
    expect(masked).not.toContain('1123')
  })
})
