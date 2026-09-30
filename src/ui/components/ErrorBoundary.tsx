import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

interface State {
  failed: boolean
}

/** Última red de seguridad: evita la pantalla en blanco ante un error inesperado. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('DWF: error inesperado', error, info.componentStack)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="type-heading">Algo salió mal</h1>
        <p className="text-fg-soft">Tus datos guardados están a salvo. Volvé a cargar la app para continuar.</p>
        <Button onClick={() => window.location.reload()}>Recargar</Button>
      </main>
    )
  }
}
