import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createAppServices } from '@/services/container'
import { AuthProvider } from '@/state/AuthContext'
import { ServicesProvider } from '@/state/ServicesContext'
import { App } from '@/ui/App'
import { ErrorBoundary } from '@/ui/components/ErrorBoundary'
import { ToastProvider } from '@/ui/components/Toast'

async function start() {
  const services = await createAppServices()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ServicesProvider services={services}>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </ServicesProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void start()
