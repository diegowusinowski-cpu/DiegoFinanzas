/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint que entrega la cotización del Dólar Blue (por defecto `/api/dolar-blue`). */
  readonly VITE_RATES_ENDPOINT?: string
  /** `local` fuerza el respaldo local (sin backend). Solo para la previsualización estática. */
  readonly VITE_DATA_MODE?: string
  /** Solo previsualización: la primera vez que se abre con este token borra los datos de prueba guardados. */
  readonly VITE_RESET_TOKEN?: string
}
