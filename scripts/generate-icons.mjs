// Genera los íconos PWA (PNG) desde una plantilla SVG usando Chromium.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const logo = JSON.parse(readFileSync(new URL('./logo-paths.json', import.meta.url), 'utf8'))

// Fondo verde bosque + logotipo DiegoFinanzas centrado; `scale` = ancho del logo sobre el lienzo.
const svg = ({ size, radius, scale }) => {
  const w = 512 * scale
  const h = w / logo.aspect
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#14392a"/>
  <svg x="${(512 - w) / 2}" y="${(512 - h) / 2}" width="${w}" height="${h}" viewBox="${logo.viewBox}"><path d="${logo.d}" fill="#f3f1ec"/></svg>
</svg>`
}

const targets = [
  { file: 'public/pwa-192.png', size: 192, radius: 112, scale: 0.66 },
  { file: 'public/pwa-512.png', size: 512, radius: 112, scale: 0.66 },
  // Maskable: fondo a sangre y contenido dentro de la zona segura (80 %).
  { file: 'public/pwa-maskable-512.png', size: 512, radius: 0, scale: 0.52 },
  { file: 'public/apple-touch-icon.png', size: 180, radius: 0, scale: 0.58 },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<body style="margin:0">${svg(t)}</body>`)
  writeFileSync(t.file, await page.screenshot({ type: 'png', omitBackground: true }))
  console.log('ok', t.file)
}
await browser.close()
