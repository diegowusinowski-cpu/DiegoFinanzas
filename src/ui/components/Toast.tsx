import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface ToastContextValue {
  show(message: string): void
}

const ToastContext = createContext<ToastContextValue>({ show: () => undefined })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2800)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-safe"
      >
        {message ? (
          <p className="animate-rise rounded-pill bg-fg px-5 py-3 text-body-sm font-medium text-canvas shadow-float">
            {message}
          </p>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
