import { useState, type ReactNode } from 'react'
import { promptInstall, useInstallState } from '@/pwa/install'
import { Button } from './Button'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="type-number grid size-7 shrink-0 place-items-center rounded-pill bg-sunken text-body-sm font-medium text-fg">{n}</span>
      <span className="pt-0.5 text-body text-fg-heading">{children}</span>
    </li>
  )
}

/**
 * Cómo instalar DWF como app. Solo aparece en el navegador (nunca si ya está instalada) y con las
 * instrucciones de cada plataforma: iPhone/Safari usa "Agregar a inicio"; Android/Chrome/Samsung
 * ofrece el cuadro nativo cuando el navegador lo permite.
 */
export function InstallApp() {
  const { standalone, platform, nativePrompt } = useInstallState()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (standalone || (platform === 'other' && !nativePrompt)) return null

  const install = async () => {
    setBusy(true)
    try {
      if (await promptInstall()) setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex justify-center pb-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="interactive inline-flex min-h-control-md items-center gap-2 rounded-pill px-4 text-body-sm font-medium text-fg-soft hover:bg-sunken"
        >
          <Icon name="download" size="sm" />
          Instalar DWF en tu celular
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Instalar DWF">
        <div className="flex flex-col gap-4 pb-2">
          {platform === 'ios' ? (
            <>
              <p className="text-body text-fg-soft">En iPhone se instala desde Safari y queda como una app más en tu pantalla de inicio.</p>
              <ol className="flex flex-col gap-3">
                <Step n={1}>Abrí DWF en <strong className="font-semibold">Safari</strong>. Si lo abriste desde otra app, tocá <strong className="font-semibold">Abrir en Safari</strong>.</Step>
                <Step n={2}>
                  Tocá <strong className="font-semibold">Compartir</strong>{' '}
                  <Icon name="share" size="sm" className="inline-block align-[-3px]" /> en la barra de Safari.
                </Step>
                <Step n={3}>Deslizá y elegí <strong className="font-semibold">Agregar a inicio</strong>.</Step>
                <Step n={4}>Tocá <strong className="font-semibold">Agregar</strong>. Listo: abrí DWF desde su ícono.</Step>
              </ol>
            </>
          ) : (
            <>
              <p className="text-body text-fg-soft">Se instala desde el navegador y queda como una app más en tu pantalla de inicio.</p>
              {nativePrompt ? (
                <Button block size="lg" loading={busy} onClick={() => void install()}>
                  <Icon name="download" />
                  Instalar ahora
                </Button>
              ) : (
                <ol className="flex flex-col gap-3">
                  <Step n={1}>Abrí DWF en <strong className="font-semibold">Chrome</strong> o <strong className="font-semibold">Samsung Internet</strong>.</Step>
                  <Step n={2}>Tocá el menú <strong className="font-semibold">⋮</strong> (o ☰) del navegador.</Step>
                  <Step n={3}>Elegí <strong className="font-semibold">Instalar app</strong> o <strong className="font-semibold">Agregar a pantalla de inicio</strong>.</Step>
                  <Step n={4}>Confirmá con <strong className="font-semibold">Instalar</strong>. Abrí DWF desde su ícono.</Step>
                </ol>
              )}
            </>
          )}
          <Button block size="lg" variant="tertiary" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Sheet>
    </>
  )
}
