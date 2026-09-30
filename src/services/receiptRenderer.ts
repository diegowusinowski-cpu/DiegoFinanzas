import { formatMoney, formatLoanDate, receiptRows, type Loan } from '@/domain'
import type { ReceiptService } from './receipt'

const WIDTH = 1080
const PAD = 72

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Corta un texto en líneas que entren en `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || line === '') line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Dibuja el comprobante con las mismas variables de color y tipografía de la
 * app. Devuelve un PNG limpio (1080 px de ancho) listo para ver, guardar o compartir.
 */
export class CanvasReceiptService implements ReceiptService {
  async render(loan: Loan, statusLabel: string): Promise<Blob> {
    const family = 'DM Sans Variable'
    await Promise.all([
      document.fonts.load(`400 32px "${family}"`),
      document.fonts.load(`500 32px "${family}"`),
      document.fonts.load(`600 32px "${family}"`),
    ]).catch(() => undefined)
    const font = (weight: number, size: number) => `${weight} ${size}px "${family}", system-ui, sans-serif`

    const colors = {
      canvas: cssVar('--color-sand-100', '#f4f0ea'),
      surface: cssVar('--color-sand-50', '#faf8f5'),
      panel: cssVar('--color-forest-900', '#14392a'),
      onPanel: cssVar('--color-on-forest', '#f3f1ec'),
      onPanelSoft: 'rgba(243, 241, 236, 0.68)',
      ink: cssVar('--color-ink-900', '#111311'),
      soft: cssVar('--color-ink-500', '#6d706c'),
      line: 'rgba(17, 19, 17, 0.10)',
    }

    const rows = receiptRows(loan, statusLabel)
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe) throw new Error('Este navegador no puede generar la imagen.')
    const innerWidth = WIDTH - PAD * 2 - 88
    const valueMax = innerWidth * 0.58

    // Altura: encabezado verde + tarjeta de filas (cada valor puede ocupar varias líneas) + pie.
    probe.font = font(500, 36)
    const rowHeights = rows.map((row) => Math.max(104, 52 + wrap(probe, row.value, valueMax).length * 46))
    const panelH = 470
    const cardH = 64 + rowHeights.reduce((a, b) => a + b, 0)
    const height = PAD + panelH + 48 + cardH + 48 + 120 + PAD / 2

    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Este navegador no puede generar la imagen.')

    ctx.fillStyle = colors.canvas
    ctx.fillRect(0, 0, WIDTH, height)

    // Encabezado: identidad + título + monto prestado.
    let y = PAD
    ctx.fillStyle = colors.panel
    roundedRect(ctx, PAD, y, WIDTH - PAD * 2, panelH, 56)
    ctx.fill()
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = colors.onPanel
    ctx.font = font(600, 64)
    ctx.fillText('DWF', PAD + 56, y + 40 + 52)
    ctx.fillStyle = colors.onPanelSoft
    ctx.font = font(400, 30)
    ctx.fillText('DiegoFinanzas', PAD + 56, y + 40 + 52 + 40)

    ctx.textAlign = 'left'
    ctx.fillStyle = colors.onPanelSoft
    ctx.font = font(500, 40)
    ctx.fillText('Comprobante de préstamo', PAD + 56, y + 268)
    ctx.fillStyle = colors.onPanel
    ctx.font = font(500, 108)
    ctx.fillText(formatMoney(loan.principalAmount), PAD + 52, y + 268 + 120)

    // Tarjeta con el detalle.
    y += panelH + 48
    ctx.fillStyle = colors.surface
    roundedRect(ctx, PAD, y, WIDTH - PAD * 2, cardH, 48)
    ctx.fill()
    let rowY = y + 32
    rows.forEach((row, i) => {
      ctx.textAlign = 'left'
      ctx.fillStyle = colors.soft
      ctx.font = font(400, 32)
      ctx.fillText(row.label, PAD + 44, rowY + 62)

      ctx.textAlign = 'right'
      ctx.fillStyle = colors.ink
      ctx.font = font(500, 36)
      wrap(ctx, row.value, valueMax).forEach((line, n) => ctx.fillText(line, WIDTH - PAD - 44, rowY + 62 + n * 46))

      rowY += rowHeights[i] ?? 104
      if (i < rows.length - 1) {
        ctx.fillStyle = colors.line
        ctx.fillRect(PAD + 44, rowY - 1, WIDTH - PAD * 2 - 88, 2)
      }
    })

    // Pie.
    ctx.textAlign = 'center'
    ctx.fillStyle = colors.soft
    ctx.font = font(400, 28)
    const issued = formatLoanDate(loan.loanDate)
    ctx.fillText(`Préstamo del ${issued}  ·  N.º ${loan.id.slice(0, 8).toUpperCase()}`, WIDTH / 2, y + cardH + 84)
    ctx.fillText('Generado con DiegoFinanzas', WIDTH / 2, y + cardH + 84 + 44)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
    })
  }
}
