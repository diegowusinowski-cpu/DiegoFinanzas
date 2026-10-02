// Verificación de la PWA en Chromium contra `vite preview` (build real con service worker).
// Uso: DWF_DB=memory DWF_E2E=1 npx vite preview --port 4173 & BASE_URL=http://127.0.0.1:4173 node scripts/pwa-check.mjs
import { chromium, devices } from 'playwright-core'
import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const log = (msg) => console.log(`✓ ${msg}`)
const pin = async (page, digits) => {
  for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click()
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function resetDatabase() {
  const response = await fetch(`${BASE_URL}/api/dwf-test-reset`, { method: 'POST' })
  assert.equal(response.status, 200, 'No se pudo reiniciar la base de pruebas (¿falta DWF_E2E=1 y DWF_DB=memory?)')
}

async function newPage(device, extra = {}) {
  const context = await browser.newContext({ ...device, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', ...extra })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()))
  await page.route('**/api/dolar-blue', (route) => route.fulfill({ status: 502, json: { error: 'source_unavailable' } }))
  await page.route(/dolarapi\.com|bluelytics\.com\.ar/, (route) => route.abort())
  return { context, page, errors }
}

async function register(page) {
  await page.goto(BASE_URL)
  await page.locator('input[type=tel]').fill('11 2345 6789')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await pin(page, '12341234')
  await page.getByTestId('balance').waitFor()
}

// ───────────────────────── 1. Manifest, íconos, pantallas de arranque ─────────────────────────
{
  const manifest = await (await fetch(`${BASE_URL}/manifest.webmanifest`)).json()
  assert.equal(manifest.name, 'DiegoFinanzas')
  assert.equal(manifest.short_name, 'DWF')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.theme_color, '#14392a')
  assert.equal(manifest.background_color, '#f4f0ea')
  assert.equal(manifest.lang, 'es-AR')
  const sizes = manifest.icons.filter((i) => i.purpose === 'any').map((i) => i.sizes)
  for (const s of ['48x48', '72x72', '96x96', '144x144', '192x192', '256x256', '384x384', '512x512']) assert.ok(sizes.includes(s), `falta el ícono ${s}`)
  const maskable = manifest.icons.filter((i) => i.purpose === 'maskable').map((i) => i.sizes)
  assert.deepEqual(maskable.sort(), ['192x192', '512x512'])
  log('manifest: nombre "DiegoFinanzas", nombre corto "DWF", standalone, colores de DWF y 10 íconos (8 normales + 2 maskable)')

  const html = await (await fetch(`${BASE_URL}/`)).text()
  for (const needle of ['rel="manifest"', 'rel="apple-touch-icon"', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-title" content="DWF"', 'name="theme-color" content="#14392a"', 'viewport-fit=cover'])
    assert.ok(html.includes(needle), `index.html sin ${needle}`)
  const splashHrefs = [...html.matchAll(/apple-touch-startup-image"[^>]*href="([^"]+)"/g)].map((m) => m[1])
  assert.ok(splashHrefs.length >= 10, 'faltan pantallas de arranque de iOS')

  const dims = async (path) => {
    const response = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`)
    assert.equal(response.status, 200, `${path} no carga`)
    assert.equal(response.headers.get('content-type'), 'image/png', `${path} no es PNG`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
  }
  for (const icon of manifest.icons) {
    const [w, h] = await dims(icon.src)
    assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} no mide ${icon.sizes}`)
  }
  assert.deepEqual(await dims('/apple-touch-icon.png'), [180, 180])
  for (const href of splashHrefs) {
    const [w, h] = await dims(href)
    assert.equal(href, `/splash/apple-splash-${w}x${h}.png`, `${href} no mide lo que dice su nombre`)
  }
  log(`íconos y ${splashHrefs.length} pantallas de arranque de iPhone: existen y miden lo declarado`)
}

// ───────────────────────── 2. Instalabilidad + service worker (Android/Chrome) ─────────────────────────
for (const [name, device] of [
  ['Android Samsung 360x780', { ...devices['Pixel 5'], viewport: { width: 360, height: 780 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' }],
  ['Android 375x812', { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } }],
  ['Android 390x844', { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }],
]) {
  await resetDatabase()
  const { context, page, errors } = await newPage(device)
  const cdp = await context.newCDPSession(page)
  await page.goto(BASE_URL)
  await page.locator('input[type=tel]').waitFor()

  // Service worker activo y controlando la página.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.locator('input[type=tel]').waitFor()
  assert.ok(await page.evaluate(() => navigator.serviceWorker.controller !== null), 'el service worker debe controlar la página')

  await cdp.send('Page.enable')
  const installability = await cdp.send('Page.getInstallabilityErrors')
  // Playwright abre contextos privados y Chrome no instala desde ahí ("in-incognito"): es el único error admitido.
  const blocking = installability.installabilityErrors.filter((e) => e.errorId !== 'in-incognito')
  assert.deepEqual(blocking, [], `no instalable: ${JSON.stringify(blocking)}`)
  const manifestInfo = await cdp.send('Page.getAppManifest')
  assert.deepEqual(manifestInfo.errors, [], `errores de manifest: ${JSON.stringify(manifestInfo.errors)}`)
  assert.ok(manifestInfo.url.endsWith('/manifest.webmanifest'))
  log(`[${name}] instalable según Chrome (sin errores de instalabilidad ni de manifest) y con service worker activo`)

  // Enlace de instalación: sin overflow y con instrucciones; el cuadro nativo se simula con el evento real.
  const link = page.getByRole('button', { name: /Instalar DWF en tu celular/ })
  await link.waitFor()
  assert.equal(await overflow(page), 0, 'sin overflow en el acceso con el enlace de instalación')
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = () => {
      window.__installPrompted = true
      return Promise.resolve()
    }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
  await link.click()
  const dialog = page.getByRole('dialog', { name: 'Instalar DWF' })
  await dialog.getByRole('button', { name: /Instalar ahora/ }).click()
  await page.waitForFunction(() => window.__installPrompted === true)
  await dialog.waitFor({ state: 'detached' })
  log(`[${name}] "Instalar ahora" dispara el cuadro nativo de instalación`)

  // El caché del service worker solo contiene interfaz: nada de /api ni datos.
  const cached = await page.evaluate(async () => {
    const urls = []
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname)
    return urls
  })
  assert.ok(cached.length > 0 && cached.every((p) => !p.startsWith('/api/')), `caché con rutas de API: ${cached.filter((p) => p.startsWith('/api/'))}`)
  assert.ok(cached.every((p) => /\.(js|css|html|svg|woff2|png|webmanifest)$|^\/$/.test(p)), `caché con recursos inesperados: ${cached}`)
  log(`[${name}] el caché del service worker solo tiene la interfaz (${cached.length} archivos), ninguna ruta /api`)
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`)
  await context.close()
}

// ───────────────────────── 3. Uso completo con la PWA activa + offline ─────────────────────────
for (const [name, device] of [
  ['375x812', { ...devices['iPhone X'], viewport: { width: 375, height: 812 } }],
  ['390x844', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
]) {
  await resetDatabase()
  const { context, page, errors } = await newPage(device, { serviceWorkers: 'allow' })
  await register(page)
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Ingreso y gasto.
  const add = async (kind, amount, concept, category) => {
    await page.getByRole('button', { name: kind, exact: true }).click()
    await page.getByRole('button', { name: /^Argentina/ }).click()
    await page.getByRole('button', { name: /^Individual/ }).click()
    await page.getByRole('main').getByRole('button', { name: new RegExp(`^${category}`) }).click()
    for (const ch of amount) await page.getByRole('button', { name: ch, exact: true }).click()
    await page.getByLabel('Concepto').fill(concept)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: kind === 'Ingreso' ? 'Confirmar ingreso' : 'Confirmar gasto' }).click()
    await page.getByTestId('movement-done').waitFor()
    await page.getByTestId('movement-done').waitFor({ state: 'detached', timeout: 6000 })
    await page.getByTestId('balance').waitFor()
  }
  await add('Ingreso', '5000', 'Sueldo PWA', 'Trabajo')
  await add('Gasto', '1200', 'Super PWA', 'Transporte')
  assert.equal(await page.getByTestId('balance').textContent(), '$ 3.800,00')
  log(`[${name}] con la PWA activa: ingreso y gasto OK, saldo $ 3.800,00`)

  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  for (const tab of ['Movimientos', 'Préstamos', 'Ahorros', 'Inicio']) {
    await nav.getByRole('button', { name: tab }).click()
    await page.waitForTimeout(250)
    assert.equal(await overflow(page), 0, `overflow en ${tab}`)
  }
  log(`[${name}] Inicio, Movimientos, Préstamos y Ahorros sin desbordes`)

  // Offline: la interfaz abre, pero NUNCA se muestran datos financieros guardados.
  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 })
  await page.waitForTimeout(800)
  const offlineText = await page.locator('body').innerText()
  assert.ok(!/Sueldo PWA|Super PWA|3\.800|\$ \d/.test(offlineText), `offline muestra datos: ${offlineText.slice(0, 300)}`)
  assert.ok(/conexi|conectar|internet|reintentar/i.test(offlineText), `offline sin aviso de conexión: ${offlineText.slice(0, 300)}`)
  assert.equal(await overflow(page), 0)
  await page.screenshot({ path: `e2e-output/pwa-offline-${name}.png` })
  log(`[${name}] sin conexión: abre la interfaz con aviso de conexión y sin ningún dato financiero`)

  // Vuelve la conexión: los datos reales vienen de la base.
  await context.setOffline(false)
  const retry = page.getByRole('button', { name: /Reintentar/ })
  if (await retry.isVisible()) await retry.click()
  else await page.reload()
  await page.locator('h1:has-text("Bienvenido de nuevo"), [data-testid=balance]').first().waitFor({ timeout: 15000 })
  if (await page.getByRole('heading', { name: /Bienvenido de nuevo/ }).isVisible()) await pin(page, '1234')
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 3.800,00')
  await page.getByText('Sueldo PWA').waitFor()
  log(`[${name}] al volver la conexión, los datos reales vuelven de la base ($ 3.800,00)`)

  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  assert.ok(!/Sueldo PWA|Super PWA/.test(stored), 'datos financieros en el almacenamiento del navegador')
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`)
  await context.close()
}

// ───────────────────────── 4. iPhone / Safari: instrucciones y modo instalado ─────────────────────────
for (const [name, device] of [
  ['iPhone 375x812', { ...devices['iPhone X'], viewport: { width: 375, height: 812 } }],
  ['iPhone 390x844', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
]) {
  await resetDatabase()
  const { context, page, errors } = await newPage(device)
  await page.goto(BASE_URL)
  await page.locator('input[type=tel]').waitFor()
  const link = page.getByRole('button', { name: /Instalar DWF en tu celular/ })
  await link.waitFor()
  assert.equal(await overflow(page), 0)
  const box = await link.boundingBox()
  assert.ok(box && box.y + box.height <= device.viewport.height, 'el enlace de instalación queda a la vista')
  await page.screenshot({ path: `e2e-output/pwa-ios-login-${name.split(' ')[1]}.png` })
  await link.click()
  const dialog = page.getByRole('dialog', { name: 'Instalar DWF' })
  await dialog.getByText('Agregar a inicio').waitFor()
  await dialog.getByText('Safari', { exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: /Instalar ahora/ }).count(), 0)
  assert.equal(await overflow(page), 0)
  await page.screenshot({ path: `e2e-output/pwa-ios-sheet-${name.split(' ')[1]}.png` })
  log(`[${name}] instrucciones de iPhone (Compartir → Agregar a inicio) sin desbordes`)
  await context.close()

  // Abierta desde el ícono (standalone): el enlace ya no aparece.
  const standalone = await newPage(device)
  // Safari expone `navigator.standalone` cuando se abre desde el ícono de inicio.
  await standalone.page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  await standalone.page.goto(BASE_URL)
  await standalone.page.locator('input[type=tel]').waitFor()
  assert.equal(await standalone.page.getByRole('button', { name: /Instalar DWF/ }).count(), 0)
  log(`[${name}] abierta como app instalada (standalone): sin enlace de instalación`)
  assert.deepEqual(errors, [])
  await standalone.context.close()
}

await browser.close()
console.log('\nPWA OK')
