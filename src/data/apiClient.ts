/** El backend respondió con un error entendible (se muestra tal cual a la persona). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** No se pudo hablar con el servidor (sin conexión, o no hay backend en este sitio). */
export class ApiUnreachableError extends Error {
  /** `network`: no hubo respuesta (sin conexión). `no-backend`: respondió algo que no es el backend (sitio estático). */
  readonly reason: 'network' | 'no-backend'
  constructor(reason: 'network' | 'no-backend' = 'network') {
    super('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.')
    this.name = 'ApiUnreachableError'
    this.reason = reason
  }
}

const TIMEOUT_MS = 15_000

/**
 * Cliente del backend de DWF (`POST /api/dwf`). La sesión viaja en una cookie HttpOnly que el
 * navegador maneja solo: la app nunca ve ni guarda credenciales.
 */
export class ApiClient {
  constructor(
    private readonly endpoint = '/api/dwf',
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    /** Se llama cuando la sesión venció (401) para volver a pedir el PIN. */
    private readonly onUnauthorized: () => void = () => undefined,
  ) {}

  async call<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
    let response: Response
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-DWF-Request': '1', Accept: 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new ApiUnreachableError()
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      // Una página que no es JSON (404 de un sitio estático, error del hosting): no hay backend en este sitio.
      throw new ApiUnreachableError('no-backend')
    }
    const body = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
    if (!response.ok) {
      if (response.status === 401) this.onUnauthorized()
      throw new ApiError(
        response.status,
        typeof body.error === 'string' ? body.error : 'server_error',
        typeof body.message === 'string' ? body.message : 'El servidor no pudo completar la operación.',
      )
    }
    return body as T
  }
}
