// Genera los íconos PWA (PNG) desde una plantilla SVG usando Chromium.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const svg = ({ size, radius, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#111111"/>
  <text x="256" y="${256 + 66 * scale}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-weight="800" font-size="${190 * scale}" letter-spacing="${-6 * scale}" fill="#ffffff">DWF</text>
</svg>`

const targets = [
  { file: 'public/pwa-192.png', size: 192, radius: 112, scale: 1 },
  { file: 'public/pwa-512.png', size: 512, radius: 112, scale: 1 },
  // Maskable: fondo a sangre y contenido dentro de la zona segura (80 %).
  { file: 'public/pwa-maskable-512.png', size: 512, radius: 0, scale: 0.78 },
  { file: 'public/apple-touch-icon.png', size: 180, radius: 0, scale: 0.86 },
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
