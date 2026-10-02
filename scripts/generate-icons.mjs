// Genera los íconos y las pantallas de arranque (PNG) de la PWA con Chromium, usando la misma tipografía
// (DM Sans) y los mismos colores que la app. Uso: node scripts/generate-icons.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const FOREST_900 = '#14392a'
const FOREST_950 = '#0b1f16'
const SAND = '#f4f0ea'

const font = readFileSync('node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2').toString('base64')
const css = `
@font-face { font-family: 'DM Sans'; font-weight: 100 1000; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; padding: 0; }
.wordmark { font-family: 'DM Sans', sans-serif; font-weight: 600; letter-spacing: -0.045em; color: ${SAND}; line-height: 1; }
`

/** Marca DWF sobre el fondo verde de la app (mismo degradado y trama que el encabezado financiero). */
const icon = ({ size, radius, scale }) => `
<div style="position:relative;width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden;
  background:repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 ${size / 256}px, transparent ${size / 256}px ${size / 16}px), linear-gradient(180deg, ${FOREST_900} 0%, ${FOREST_950} 100%);
  display:grid;place-items:center">
  <div class="wordmark" style="font-size:${size * 0.4 * scale}px;transform:translateY(${size * -0.01}px)">DWF</div>
</div>`

/** Pantalla de arranque de iOS: fondo claro de la app con la marca centrada. */
const splash = ({ width, height, ratio }) => {
  const mark = Math.round(Math.min(width, height) * 0.2)
  return `
<div style="width:${width / ratio}px;height:${height / ratio}px;background:${SAND};display:grid;place-items:center">
  <div style="width:${mark / ratio}px;height:${mark / ratio}px;border-radius:${(mark * 0.22) / ratio}px;overflow:hidden;
    background:repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px ${mark / ratio / 16}px), linear-gradient(180deg, ${FOREST_900} 0%, ${FOREST_950} 100%);
    display:grid;place-items:center;box-shadow:0 ${mark / ratio / 12}px ${mark / ratio / 4}px rgba(11,31,22,0.18)">
    <div class="wordmark" style="font-size:${(mark * 0.4) / ratio}px;transform:translateY(${(-mark * 0.01) / ratio}px)">DWF</div>
  </div>
</div>`
}

export const SPLASHES = [
  // [ancho lógico, alto lógico, ratio, nombre de los dispositivos]
  [430, 932, 3, 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max'],
  [428, 926, 3, 'iPhone 12/13 Pro Max / 14 Plus'],
  [393, 852, 3, 'iPhone 14 Pro / 15 / 15 Pro / 16'],
  [390, 844, 3, 'iPhone 12/13/14 / 12/13 Pro'],
  [414, 896, 3, 'iPhone XS Max / 11 Pro Max'],
  [414, 896, 2, 'iPhone XR / 11'],
  [375, 812, 3, 'iPhone X / XS / 11 Pro / 12/13 mini'],
  [414, 736, 3, 'iPhone 6/7/8 Plus'],
  [375, 667, 2, 'iPhone 6/7/8 / SE 2 y 3'],
  [320, 568, 2, 'iPhone SE 1'],
  [402, 874, 3, 'iPhone 16 Pro'],
  [440, 956, 3, 'iPhone 16 Pro Max'],
]

mkdirSync('public/icons', { recursive: true })
mkdirSync('public/splash', { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage()

async function render(html, width, height, file) {
  await page.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) })
  await page.setContent(`<style>${css}</style><body>${html}</body>`)
  await page.evaluate(() => document.fonts.ready)
  writeFileSync(file, await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width, height } }))
  console.log('ok', file)
}

// Íconos "any" (esquinas redondeadas) en todos los tamaños de lanzador de Android y de pestaña.
for (const size of [48, 72, 96, 144, 192, 256, 384, 512]) {
  await render(icon({ size, radius: Math.round(size * 0.22), scale: 0.86 }), size, size, `public/icons/icon-${size}.png`)
}
// Maskable: fondo a sangre y contenido dentro de la zona segura (80 %).
for (const size of [192, 512]) {
  await render(icon({ size, radius: 0, scale: 0.78 }), size, size, `public/icons/maskable-${size}.png`)
}
// iOS aplica su propia máscara: ícono cuadrado, sin transparencia, a sangre.
await render(icon({ size: 180, radius: 0, scale: 0.9 }), 180, 180, 'public/apple-touch-icon.png')
await render(icon({ size: 32, radius: 7, scale: 1.05 }), 32, 32, 'public/icons/favicon-32.png')

// Pantallas de arranque de iOS (se renderizan con la densidad real del dispositivo).
for (const [w, h, ratio] of SPLASHES) {
  const pxW = w * ratio
  const pxH = h * ratio
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: ratio })
  const shotPage = await context.newPage()
  await shotPage.setContent(`<style>${css}</style><body>${splash({ width: pxW, height: pxH, ratio })}</body>`)
  await shotPage.evaluate(() => document.fonts.ready)
  writeFileSync(`public/splash/apple-splash-${pxW}x${pxH}.png`, await shotPage.screenshot({ type: 'png' }))
  console.log('ok', `public/splash/apple-splash-${pxW}x${pxH}.png`)
  await context.close()
}
await browser.close()
