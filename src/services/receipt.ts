import type { Loan } from '@/domain'

/** Genera la imagen del comprobante de un préstamo (PNG); `statusLabel` es su estado actual. */
export interface ReceiptService {
  render(loan: Loan, statusLabel: string): Promise<Blob>
}

export type ShareOutcome = 'shared' | 'cancelled'

/** Compartir con el sistema nativo del dispositivo, o guardar la imagen. */
export interface ShareService {
  /** `true` si el navegador puede compartir este archivo con el menú nativo. */
  canShareFile(file: File): boolean
  shareFile(file: File, message: { title: string; text?: string }): Promise<ShareOutcome>
  /** Descarga el archivo (alternativa cuando no se puede compartir). */
  download(blob: Blob, filename: string): void
}

/** `comprobante-prestamo-carlos-mendoza-2026-10-02.png` */
export function receiptFilename(loan: Pick<Loan, 'borrowerName' | 'loanDate'>): string {
  const slug = loan.borrowerName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `comprobante-prestamo-${slug || 'prestatario'}-${loan.loanDate}.png`
}

export class BrowserShareService implements ShareService {
  canShareFile(file: File): boolean {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  }

  async shareFile(file: File, message: { title: string; text?: string }): Promise<ShareOutcome> {
    try {
      await navigator.share({ files: [file], title: message.title, ...(message.text ? { text: message.text } : {}) })
      return 'shared'
    } catch (error) {
      // Cerrar el menú nativo sin elegir no es un error.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }

  download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
