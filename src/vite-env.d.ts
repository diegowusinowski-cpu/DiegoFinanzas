/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint que entrega la cotización del Dólar Blue (por defecto `/api/dolar-blue`). */
  readonly VITE_RATES_ENDPOINT?: string
}
