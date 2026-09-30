import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserShareService, receiptFilename } from './receipt'

afterEach(() => vi.unstubAllGlobals())

describe('receiptFilename', () => {
  it('normaliza el nombre (tildes, espacios y símbolos)', () => {
    expect(receiptFilename({ borrowerName: 'Carlos Mendoza', loanDate: '2026-10-02' })).toBe(
      'comprobante-prestamo-carlos-mendoza-2026-10-02.png',
    )
    expect(receiptFilename({ borrowerName: '  Ñandú  Pérez-Gómez! ', loanDate: '2026-01-05' })).toBe(
      'comprobante-prestamo-nandu-perez-gomez-2026-01-05.png',
    )
    expect(receiptFilename({ borrowerName: '???', loanDate: '2026-01-05' })).toBe('comprobante-prestamo-prestatario-2026-01-05.png')
  })
})

describe('BrowserShareService', () => {
  const file = new File(['x'], 'a.png', { type: 'image/png' })

  it('detecta si el navegador puede compartir archivos', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => true })
    expect(new BrowserShareService().canShareFile(file)).toBe(true)
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false })
    expect(new BrowserShareService().canShareFile(file)).toBe(false)
    vi.stubGlobal('navigator', {})
    expect(new BrowserShareService().canShareFile(file)).toBe(false)
  })

  it('comparte con el menú nativo', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    await expect(new BrowserShareService().shareFile(file, { title: 'T', text: 'x' })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'T', text: 'x' })
  })

  it('cerrar el menú sin elegir no es un error', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')), canShare: () => true })
    await expect(new BrowserShareService().shareFile(file, { title: 'T' })).resolves.toBe('cancelled')
  })

  it('otros errores se propagan', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('boom')), canShare: () => true })
    await expect(new BrowserShareService().shareFile(file, { title: 'T' })).rejects.toThrow('boom')
  })
})
