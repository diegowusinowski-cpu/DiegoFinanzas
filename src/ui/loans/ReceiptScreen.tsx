import { useEffect, useMemo, useState } from 'react'
import { LOAN_VIEW_LABEL, installmentsOf, loanView, type Loan } from '@/domain'
import { receiptFilename } from '@/services/receipt'
import { useFinance } from '@/state/FinanceContext'
import { useServices } from '@/state/ServicesContext'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { FlowFrame } from '../flow/FlowFrame'
import { LucaLoader, LucaMascot, createdLoanLuca } from '../luca'

type ReceiptState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; blob: Blob; url: string }

interface ReceiptScreenProps {
  loan: Loan
  /** `created`: recién creado; `view`: se abre desde el detalle. */
  mode: 'created' | 'view'
  onClose(): void
}

/** Comprobante del préstamo como imagen: se ve, se guarda y se comparte con el menú nativo si existe. */
export function ReceiptScreen({ loan, mode, onClose }: ReceiptScreenProps) {
  const { receipts, sharing } = useServices()
  const toast = useToast()
  const { installments, today } = useFinance()
  const statusLabel = LOAN_VIEW_LABEL[loanView(loan, installmentsOf(loan.id, installments), today)]
  const [state, setState] = useState<ReceiptState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    receipts.render(loan, statusLabel).then(
      (blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setState({ status: 'ready', blob, url })
      },
      () => {
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [loan, statusLabel, receipts, attempt])

  const filename = receiptFilename(loan)
  const file = useMemo(
    () => (state.status === 'ready' ? new File([state.blob], filename, { type: 'image/png' }) : null),
    [state, filename],
  )
  const canShare = file !== null && sharing.canShareFile(file)

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const share = async () => {
    if (!file) return
    setMessage(null)
    try {
      await sharing.shareFile(file, { title: 'Comprobante de préstamo', text: `Préstamo a ${loan.borrowerName}` })
    } catch {
      setMessage('No se pudo abrir el menú de compartir. Probá guardar la imagen.')
    }
  }

  const save = () => {
    if (state.status !== 'ready') return
    setMessage(null)
    sharing.download(state.blob, filename)
    toast.show('Imagen guardada')
  }

  return (
    <FlowFrame className="animate-sheet">
      <div role="dialog" aria-modal="true" aria-label="Comprobante de préstamo" className="flex min-h-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-gutter pt-safe pb-2">
          <div className="flex min-w-0 items-center gap-3">
            {/* Préstamo recién creado: Luca contenta. */}
            {mode === 'created' ? <LucaMascot variant={createdLoanLuca} size="md" /> : null}
            <div className="min-w-0">
              <h1 className="type-heading">{mode === 'created' ? 'Préstamo creado' : 'Comprobante'}</h1>
              <p className="text-body-sm text-fg-soft">Comprobante de préstamo</p>
            </div>
          </div>
          <IconButton variant="secondary" size="md" onClick={onClose} aria-label="Cerrar comprobante">
            <Icon name="close" />
          </IconButton>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-gutter py-3">
          {state.status === 'loading' ? (
            <LucaLoader label="Generando comprobante" />
          ) : state.status === 'error' ? (
            <div className="flex flex-col items-center gap-3 text-center" role="alert">
              <LucaMascot variant="error" size="lg" />
              <p className="text-body text-fg-soft">No se pudo generar la imagen del comprobante.</p>
              <Button variant="secondary" size="sm" onClick={retry}>
                Reintentar
              </Button>
            </div>
          ) : (
            <img
              src={state.url}
              alt="Comprobante de préstamo"
              className="max-h-full w-auto max-w-full rounded-card object-contain shadow-float"
            />
          )}
        </main>

        <div className="flex shrink-0 flex-col gap-2 px-gutter pt-2 pb-safe">
          {message ? (
            <p role="alert" className="rounded-control bg-danger-bg p-3 text-body-sm text-danger">
              {message}
            </p>
          ) : null}
          {canShare ? (
            <Button block size="lg" onClick={() => void share()}>
              <Icon name="share" />
              Compartir
            </Button>
          ) : null}
          <Button
            block
            size="lg"
            variant={canShare ? 'secondary' : 'primary'}
            disabled={state.status !== 'ready'}
            onClick={save}
          >
            <Icon name="download" />
            Guardar imagen
          </Button>
          <Button block size="md" variant="tertiary" onClick={onClose}>
            {mode === 'created' ? 'Listo' : 'Cerrar'}
          </Button>
        </div>
      </div>
    </FlowFrame>
  )
}
