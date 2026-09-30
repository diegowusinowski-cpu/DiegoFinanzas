// Prueba de humo en navegador real (Chromium) con viewport móvil.
// Uso: BASE_URL=http://localhost:5173 npm run e2e
import { chromium, devices } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = 'e2e-output'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const log = (msg) => console.log(`✓ ${msg}`)

async function pin(page, digits) {
  for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click()
}

async function addMovement(page, kind, { amount, description, category, date, time }) {
  await page.getByRole('button', { name: kind, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo movimiento' })
  await dialog.getByLabel('Monto').fill(amount)
  await dialog.getByLabel('Descripción').fill(description)
  await dialog.getByText(category, { exact: true }).click()
  if (date) await dialog.getByLabel('Fecha').fill(date)
  if (time) await dialog.getByLabel('Hora').fill(time)
  await dialog.getByRole('button', { name: /Registrar/ }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function run(name, device, { mockRate } = {}) {
  const context = await browser.newContext({ ...device, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  if (mockRate) {
    await page.route('**/api/dolar-blue', (route) =>
      route.fulfill({
        json: {
          buy: 1385,
          sell: 1405.5,
          updatedAt: '2026-09-30T15:05:00.000Z',
          fetchedAt: '2026-09-30T15:10:00.000Z',
          source: { name: 'DolarHoy.com', url: 'https://dolarhoy.com/' },
        },
      }),
    )
  }

  await page.goto(BASE_URL)
  // Primer ingreso: alta de teléfono + PIN
  await page.getByLabel('Número de teléfono').fill('11 2345 6789')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await pin(page, '1234')
  await pin(page, '1234')
  await page.getByTestId('balance').waitFor()
  log(`[${name}] alta de PIN y acceso al dashboard`)

  // Sin scroll horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.equal(overflow, 0, 'no debe haber scroll horizontal')
  log(`[${name}] sin scroll horizontal`)

  assert.equal(await page.getByTestId('balance').textContent(), '$ 0,00')
  await page.screenshot({ path: `${OUT}/${name}-1-dashboard-vacio.png`, fullPage: true })

  await addMovement(page, 'Ingreso', { amount: '10.000', description: 'Sueldo octubre', category: 'Sueldo' })
  await page.getByText('Sueldo octubre').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 10.000,00')
  log(`[${name}] ingreso suma al saldo: $ 10.000,00`)

  await addMovement(page, 'Gasto', { amount: '2500,50', description: 'Supermercado', category: 'Comida' })
  await page.getByText('Supermercado').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 7.499,50')
  log(`[${name}] gasto resta del saldo: $ 7.499,50`)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  await addMovement(page, 'Gasto', { amount: '100', description: 'Mov B', category: 'Comida', date: '2020-01-02', time: '10:00' })
  await addMovement(page, 'Gasto', { amount: '200', description: 'Mov A', category: 'Comida', date: '2020-01-01', time: '10:00' })
  const items = page.getByTestId('latest-movements').getByRole('listitem')
  assert.equal(await items.count(), 3)
  const texts = await items.allTextContents()
  assert.match(texts[0], /Supermercado/)
  assert.match(texts[1], /Sueldo octubre/)
  assert.match(texts[2], /Mov B/)
  assert.ok(!texts.join('').includes('Mov A'), 'el más antiguo no debe aparecer')
  assert.equal(await page.getByTestId('balance').textContent(), '$ 7.199,50')
  log(`[${name}] últimos movimientos: exactamente 3, ordenados por fecha (hoy=${today})`)

  // Tasas de conversión
  if (mockRate) {
    await page.getByTestId('rate-buy').waitFor()
    assert.match(await page.getByTestId('rate-buy').textContent(), /1\.385/)
    assert.match(await page.getByTestId('rate-sell').textContent(), /1\.405,5/)
    log(`[${name}] Dólar Blue mostrado (compra/venta)`)
  } else {
    await page.getByText(/cotización no está disponible/).waitFor()
    log(`[${name}] cotización no disponible: estado de indisponibilidad, sin valores inventados`)
  }

  // Recordatorio
  await page.getByRole('button', { name: '+ Agregar' }).click()
  const reminder = page.getByRole('dialog', { name: 'Nuevo recordatorio' })
  await reminder.getByLabel('Título').fill('Cuota el 6 de Octubre')
  await reminder.getByLabel('Detalle (opcional)').fill('Detalle de prueba')
  await reminder.getByLabel('Fecha').fill('2026-10-06')
  await reminder.getByRole('button', { name: 'Guardar recordatorio' }).click()
  await page.getByText('Cuota el 6 de Octubre').waitFor()
  await page.screenshot({ path: `${OUT}/${name}-2-dashboard-completo.png`, fullPage: true })
  log(`[${name}] recordatorio creado`)

  // Navegación
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await page.getByRole('heading', { name: 'Movimientos' }).waitFor()
  assert.equal(await page.getByText(/^(Supermercado|Sueldo octubre|Mov A|Mov B)$/).count(), 4)
  await page.screenshot({ path: `${OUT}/${name}-3-movimientos.png`, fullPage: true })
  await page.getByRole('button', { name: 'Más', exact: true }).click()
  await page.getByRole('heading', { name: 'Más' }).waitFor()
  await page.screenshot({ path: `${OUT}/${name}-4-mas.png`, fullPage: true })
  await page.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  await page.getByRole('dialog', { name: 'Nuevo movimiento' }).waitFor()
  await page.screenshot({ path: `${OUT}/${name}-5-formulario.png` })
  await page.keyboard.press('Escape')
  log(`[${name}] navegación Inicio / Movimientos / + / Más`)

  // Persistencia + bloqueo con PIN
  await page.reload()
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 7.199,50')
  await page.getByRole('button', { name: 'Más', exact: true }).click()
  await page.getByRole('button', { name: 'Bloquear DWF' }).click()
  await page.getByRole('heading', { name: 'Bienvenido de nuevo, Diego' }).waitFor()
  assert.ok(await page.getByText('+54 •••••••• 789').isVisible())
  await page.screenshot({ path: `${OUT}/${name}-6-acceso.png` })
  await pin(page, '0000')
  await page.getByText(/PIN incorrecto/).waitFor()
  await pin(page, '1234')
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 7.199,50')
  log(`[${name}] datos persistidos, bloqueo, PIN incorrecto y PIN correcto`)

  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }))
  assert.ok(!stored.includes('"1234"') && !/pin"?:\s*"?1234/.test(stored), 'el PIN no debe estar en texto plano')
  assert.ok(!(await page.locator('body').innerText()).match(/ARQ/i), 'no debe aparecer ARQ')
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`)
  log(`[${name}] PIN no almacenado en texto plano, sin "ARQ", sin errores de consola`)
  await context.close()
}

try {
  await run('android-360', { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } })
  await run('iphone-390', devices['iPhone 13'], { mockRate: true })
  await run('escritorio', { viewport: { width: 1280, height: 800 } }, { mockRate: true })
  console.log('\nE2E OK')
} finally {
  await browser.close()
}
