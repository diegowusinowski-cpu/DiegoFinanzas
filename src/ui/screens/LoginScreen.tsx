import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PIN_LENGTH, maskPhone, normalizePhone } from '@/services/auth'
import { useAuth } from '@/state/AuthContext'
import { Button } from '../components/Button'
import { BRAND_NAME, Wordmark } from '../components/Brand'
import { Field, inputClass } from '../components/Field'
import { PinDots, PinPad } from '../components/PinPad'
import { Sheet } from '../components/Sheet'

type Step = 'phone' | 'create' | 'confirm'
type ConfirmAction = 'other-number' | 'forgot' | null

/** Segundos restantes hasta `until` (0 si no hay bloqueo o ya venció). */
function useCountdown(until: number | null): number {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (until === null) return
    const tick = () => setNowMs(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 500)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [until])
  return until === null ? 0 : Math.max(0, Math.ceil((until - nowMs) / 1000))
}

const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Acceso: PIN para volver a entrar; alta de teléfono + PIN la primera vez. */
export function LoginScreen() {
  const { status, profile } = useAuth()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe pb-safe">
      <header className="flex flex-col items-center gap-1 pt-6">
        <Wordmark size="lg" />
        <p className="type-eyebrow text-fg-muted">{BRAND_NAME}</p>
      </header>
      {status === 'setup' ? <SetupFlow /> : <PinLogin name={profile?.displayName ?? ''} phone={profile?.phone ?? ''} />}
    </main>
  )
}

function PinLogin({ name, phone }: { name: string; phone: string }) {
  const { unlock, getLockedUntil } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const remaining = useCountdown(lockedUntil)
  const locked = lockedUntil !== null && remaining > 0

  useEffect(() => {
    void getLockedUntil().then(setLockedUntil)
  }, [getLockedUntil])

  const submit = useCallback(
    async (value: string) => {
      setBusy(true)
      try {
        const result = await unlock(value)
        if (result.status === 'ok') return
        setPin('')
        setShake((n) => n + 1)
        if (result.status === 'locked') {
          setLockedUntil(result.retryAt)
          setError('Demasiados intentos fallidos.')
        } else {
          setError(
            result.attemptsLeft === 1
              ? 'PIN incorrecto. Te queda 1 intento.'
              : `PIN incorrecto. Te quedan ${result.attemptsLeft} intentos.`,
          )
        }
      } catch (e) {
        setPin('')
        setError(e instanceof Error ? e.message : 'No se pudo verificar el PIN.')
      } finally {
        setBusy(false)
      }
    },
    [unlock],
  )

  const onDigit = (digit: string) => {
    if (busy || locked || pin.length >= PIN_LENGTH) return
    setError(null)
    const next = pin + digit
    setPin(next)
    if (next.length === PIN_LENGTH) void submit(next)
  }
  const onBackspace = () => {
    if (busy || locked) return
    setPin((prev) => prev.slice(0, -1))
  }

  return (
    <>
      <section className="flex flex-1 flex-col items-center justify-center gap-3 pt-10 text-center animate-rise">
        <h1 className="type-heading text-balance">
          Bienvenido de nuevo, <em className="font-semibold not-italic">{name}</em>
        </h1>
        <p className="type-number text-body-sm text-fg-soft" aria-label="Número de teléfono parcialmente oculto">
          {maskPhone(phone)}
        </p>
        <div className="mt-6" key={shake}>
          <PinDots length={pin.length} shake={shake > 0} label="PIN ingresado" />
        </div>
        <p role="alert" className="min-h-6 text-body-sm text-danger">
          {locked ? `Probá de nuevo en ${formatCountdown(remaining)}.` : error}
        </p>
      </section>

      <section className="pb-2">
        <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={busy || locked} />
        <nav className="mt-5 flex flex-col items-center gap-1" aria-label="Otras opciones de acceso">
          <button
            type="button"
            className="type-eyebrow min-h-11 px-4 text-fg underline underline-offset-4"
            onClick={() => setConfirm('other-number')}
          >
            Usar otro número de teléfono
          </button>
          <button
            type="button"
            className="type-eyebrow min-h-11 px-4 text-fg-soft underline underline-offset-4"
            onClick={() => setConfirm('forgot')}
          >
            No recuerdo mi contraseña
          </button>
        </nav>
      </section>

      <ResetAccessSheet action={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

function ResetAccessSheet({ action, onClose }: { action: ConfirmAction; onClose(): void }) {
  const { resetAccess } = useAuth()
  const [busy, setBusy] = useState(false)
  const forgot = action === 'forgot'

  const run = async () => {
    setBusy(true)
    try {
      await resetAccess()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={action !== null} onClose={onClose} title={forgot ? 'Recuperar acceso' : 'Usar otro número'}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-body text-fg-heading">
          {forgot
            ? 'La recuperación por SMS estará disponible cuando se active la autenticación definitiva. Mientras tanto podés crear un PIN nuevo en este dispositivo.'
            : 'Vas a registrar otro número de teléfono y crear un PIN nuevo en este dispositivo.'}
        </p>
        <p className="text-body-sm text-fg-soft">Tus movimientos guardados no se borran.</p>
        <Button block loading={busy} onClick={() => void run()}>
          {forgot ? 'Crear un PIN nuevo' : 'Continuar'}
        </Button>
        <Button block variant="tertiary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  )
}

function SetupFlow() {
  const { enroll } = useAuth()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const submitPhone = (event: FormEvent) => {
    event.preventDefault()
    if (!normalizePhone(phone)) {
      setPhoneError('Ingresá un número válido, con código de área.')
      return
    }
    setPhoneError(undefined)
    setStep('create')
  }

  const finish = useCallback(
    async (confirmed: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        await enroll(phone, confirmed)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar el PIN.')
        setPin('')
        setStep('create')
        setFirstPin('')
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [enroll, phone],
  )

  const onDigit = (digit: string) => {
    if (busy) return
    setError(null)
    const current = pin
    if (current.length >= PIN_LENGTH) return
    const next = current + digit
    setPin(next)
    if (next.length < PIN_LENGTH) return
    if (step === 'create') {
      setFirstPin(next)
      setPin('')
      setStep('confirm')
    } else if (next === firstPin) {
      void finish(next)
    } else {
      setShake((n) => n + 1)
      setPin('')
      setFirstPin('')
      setStep('create')
      setError('Los PIN no coinciden. Empecemos de nuevo.')
    }
  }
  const onBackspace = () => {
    if (!busy) setPin((prev) => prev.slice(0, -1))
  }

  if (step === 'phone') {
    return (
      <form onSubmit={submitPhone} className="flex flex-1 flex-col justify-center gap-6 animate-rise" noValidate>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="type-heading">
            Bienvenido, <em className="font-semibold not-italic">Diego</em>
          </h1>
          <p className="text-body text-fg-soft">Registrá tu número de teléfono para proteger tu cuenta.</p>
        </div>
        <Field label="Número de teléfono" error={phoneError}>
          <input
            data-autofocus
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="11 2345 6789"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Button type="submit" block>
          Continuar
        </Button>
      </form>
    )
  }

  const creating = step === 'create'
  return (
    <>
      <section className="flex flex-1 flex-col items-center justify-center gap-3 pt-10 text-center animate-rise">
        <h1 className="type-heading">
          {creating ? 'Creá tu PIN' : 'Confirmá tu PIN'}
        </h1>
        <p className="text-body text-fg-soft">
          {creating ? 'Elegí 4 dígitos para entrar a DWF.' : 'Ingresá el mismo PIN otra vez.'}
        </p>
        <div className="mt-6" key={shake}>
          <PinDots length={pin.length} shake={shake > 0} label="PIN ingresado" />
        </div>
        <p role="alert" className="min-h-6 text-body-sm text-danger">
          {error}
        </p>
      </section>
      <section className="pb-2">
        <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={busy} />
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="type-eyebrow min-h-11 px-4 text-fg underline underline-offset-4"
            onClick={() => {
              setPin('')
              setFirstPin('')
              setError(null)
              setStep('phone')
            }}
          >
            Cambiar número de teléfono
          </button>
        </div>
      </section>
    </>
  )
}
