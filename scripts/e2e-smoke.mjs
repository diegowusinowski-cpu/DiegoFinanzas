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

/** Flujo completo: país → Individual → tipo → monto → confirmar → confirmación → Home. */
async function addMovement(page, kind, { amount, concept, category, date, method }) {
  await page.getByRole('button', { name: kind, exact: true }).click()
  await page.getByRole('button', { name: /^Argentina/ }).click()
  await page.getByRole('button', { name: /^Individual/ }).click()
  await page.getByRole('main').getByRole('button', { name: new RegExp(`^${category}`) }).click()
  for (const ch of amount) await page.getByRole('button', { name: ch === ',' ? 'Coma decimal' : ch, exact: true }).click()
  if (concept) await page.getByLabel('Concepto').fill(concept)
  await page.getByRole('button', { name: 'Continuar' }).click()
  if (method) await page.getByRole('radio', { name: method }).click()
  if (date) await page.getByLabel('Fecha').fill(date)
  await page.getByRole('button', { name: kind === 'Ingreso' ? 'Confirmar ingreso' : 'Confirmar gasto' }).click()
  const done = page.getByTestId('movement-done')
  await done.waitFor()
  await page.getByTestId('done-check').waitFor()
  await done.waitFor({ state: 'detached', timeout: 6000 })
  await page.getByTestId('balance').waitFor()
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

  await addMovement(page, 'Ingreso', { amount: '10000', concept: 'Sueldo octubre', category: 'Trabajo en relación de dependencia' })
  await page.getByText('Sueldo octubre').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 10.000,00')
  log(`[${name}] ingreso suma al saldo: $ 10.000,00`)

  await addMovement(page, 'Gasto', { amount: '2500,5', concept: 'Supermercado', category: 'Transporte y movilidad', method: 'Efectivo' })
  await page.getByText('Supermercado').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 7.499,50')
  log(`[${name}] gasto resta del saldo: $ 7.499,50`)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  await addMovement(page, 'Gasto', { amount: '100', concept: 'Mov B', category: 'Salidas y ocio', date: '2020-01-02' })
  await addMovement(page, 'Gasto', { amount: '200', concept: 'Mov A', category: 'Salidas y ocio', date: '2020-01-01' })
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
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${OUT}/${name}-2b-dashboard-pantalla.png` })
  log(`[${name}] recordatorio creado`)

  // Navegación
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await page.getByRole('heading', { name: 'Movimientos' }).waitFor()
  assert.equal(await page.getByText(/^(Supermercado|Sueldo octubre|Mov A|Mov B)$/).count(), 4)
  const rowCount = () => page.getByRole('button', { name: /Ver detalle$/ }).count()
  assert.equal(await rowCount(), 4)
  await page.getByRole('searchbox').fill('mov a')
  assert.equal(await rowCount(), 1)
  await page.getByRole('searchbox').fill('')
  await page.getByRole('button', { name: /^Filtrar movimientos/ }).click()
  await page.getByRole('radio', { name: 'Ingresos' }).click()
  assert.equal(await rowCount(), 1)
  await page.getByRole('button', { name: /^Filtrar movimientos/ }).click()
  await page.getByRole('radio', { name: 'Gastos' }).click()
  await page.getByRole('searchbox').fill('supermercado')
  assert.equal(await rowCount(), 1)
  await page.screenshot({ path: `${OUT}/${name}-3b-movimientos-filtrado.png` })
  await page.getByRole('button', { name: /^Supermercado/ }).click()
  await page.getByRole('dialog', { name: 'Detalle del movimiento' }).waitFor()
  await page.screenshot({ path: `${OUT}/${name}-3c-detalle.png` })
  await page.getByRole('button', { name: 'Cerrar detalle' }).click()
  await page.getByRole('searchbox').fill('')
  await page.getByRole('button', { name: /^Filtrar movimientos/ }).click()
  await page.getByRole('radio', { name: 'Todos' }).click()
  log(`[${name}] Movimientos: búsqueda, filtro, combinación y detalle`)
  await page.screenshot({ path: `${OUT}/${name}-3-movimientos.png`, fullPage: true })
  await page.getByRole('button', { name: 'Más', exact: true }).click()
  await page.getByRole('heading', { name: 'Más' }).waitFor()
  await page.screenshot({ path: `${OUT}/${name}-4-mas.png`, fullPage: true })
  await page.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await nav.getByRole('button', { name: 'Préstamos', exact: true }).click()
  await page.getByRole('heading', { name: 'Préstamos', level: 1 }).waitFor()
  assert.equal(await nav.getByRole('button', { name: 'Préstamos', exact: true }).getAttribute('aria-current'), 'page')
  await page.screenshot({ path: `${OUT}/${name}-5-prestamos.png` })
  await nav.getByRole('button', { name: 'Registrar movimiento' }).click()
  await page.getByRole('dialog', { name: 'Nuevo movimiento' }).getByRole('button', { name: /^Ingreso/ }).waitFor()
  await page.keyboard.press('Escape')
  await nav.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  log(`[${name}] navegación Inicio / Movimientos / + (Ingreso·Gasto) / Préstamos / Más`)

  // Préstamos (pestaña): calculadora → nuevo préstamo → comprobante → cobro de cuota → saldo
  await nav.getByRole('button', { name: 'Préstamos', exact: true }).click()
  await page.getByRole('heading', { name: 'Préstamos', level: 1 }).waitFor()
  await page.getByRole('button', { name: /^Calculadora financiera/ }).click()
  for (const ch of '100000') await page.getByRole('button', { name: ch, exact: true }).click()
  assert.match(await page.getByLabel('Cálculo del préstamo').innerText(), /70\.000,00[\s\S]*170\.000,00/)
  assert.equal(await page.getByRole('button', { name: 'Continuar' }).count(), 0) // la calculadora es de consulta: sin pasos
  await page.screenshot({ path: `${OUT}/${name}-5a-calculadora.png` })
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  assert.equal(await page.getByTestId('loans-total-lent').textContent(), '$ 0,00') // no creó nada
  await page.getByRole('button', { name: /^Nuevo préstamo/ }).click()
  for (const ch of '1000') await page.getByRole('button', { name: ch, exact: true }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('radio', { name: '4 cuotas' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Fecha del préstamo').fill('2026-10-02')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Fecha límite de pago').fill('2027-04-02')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nombre').fill('Carlos Mendoza')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Crear préstamo' }).click()
  await page.getByRole('img', { name: 'Comprobante de préstamo' }).waitFor()
  await page.screenshot({ path: `${OUT}/${name}-4b-comprobante.png` })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Guardar imagen' }).click()
  const file = await download
  assert.equal(file.suggestedFilename(), 'comprobante-prestamo-carlos-mendoza-2026-10-02.png')
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.getByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' }).click()
  assert.equal(await page.getByRole('dialog', { name: 'Detalle del préstamo' }).getByRole('listitem').count(), 4)
  await page.screenshot({ path: `${OUT}/${name}-5b-prestamo-detalle.png` })
  await page.getByRole('button', { name: 'Cerrar detalle' }).click()
  assert.equal(await page.getByTestId('loans-total-lent').textContent(), '$ 1.000,00')
  assert.equal(await page.getByTestId('loans-total-pending').textContent(), '$ 1.700,00')
  await nav.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 6.199,50') // baja solo lo prestado ($ 1.000), no el interés
  log(`[${name}] Préstamos: calculadora, creación, comprobante (descarga), cuotas y saldo -$ 1.000`)

  // Cobro de la cuota 1 ($ 425): ingreso, saldo y resumen.
  await nav.getByRole('button', { name: 'Préstamos', exact: true }).click()
  await page.getByRole('button', { name: 'Préstamo de Carlos Mendoza. Ver detalle' }).click()
  await page.getByRole('button', { name: 'Marcar cuota 1 como pagada' }).click()
  await page.screenshot({ path: `${OUT}/${name}-5c-cobrar-cuota.png` })
  await page.getByRole('dialog', { name: 'Cobrar cuota' }).getByRole('button', { name: 'Confirmar cobro' }).click()
  await page.getByRole('dialog', { name: 'Detalle del préstamo' }).getByText('1 de 4 cuotas pagadas').waitFor()
  await page.getByRole('button', { name: 'Cerrar detalle' }).click()
  assert.equal(await page.getByTestId('loans-total-collected').textContent(), '$ 425,00')
  assert.equal(await page.getByTestId('loans-total-pending').textContent(), '$ 1.275,00')
  await nav.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 6.624,50')
  log(`[${name}] Cobro de cuota: ingreso +$ 425, saldo y resumen actualizados`)

  // Ahorros (frascos): crear, aportar; el saldo total NO baja, solo lo disponible
  await nav.getByRole('button', { name: 'Ahorros', exact: true }).click()
  await page.getByRole('heading', { name: 'Ahorros', level: 1 }).waitFor()
  assert.equal(await nav.getByRole('button', { name: 'Ahorros', exact: true }).getAttribute('aria-current'), 'page')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('nav button')].filter((b) => b.scrollWidth > b.clientWidth + 0.5).length), 0)
  await page.screenshot({ path: `${OUT}/${name}-5d-ahorros.png` })
  await page.getByRole('button', { name: /^Nuevo frasco/ }).click()
  await page.getByLabel('Nombre').fill('Vacaciones')
  await page.getByRole('button', { name: 'Continuar' }).click()
  for (const ch of '1000') await page.getByRole('button', { name: ch, exact: true }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('radio', { name: 'Mensual' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  for (const ch of '100') await page.getByRole('button', { name: ch, exact: true }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Crear frasco' }).click()
  const jar = page.getByRole('dialog', { name: 'Detalle del frasco' })
  await jar.waitFor()
  await page.getByRole('button', { name: 'Agregar dinero' }).click()
  for (const ch of '200') await page.getByRole('button', { name: ch, exact: true }).click()
  await page.getByRole('button', { name: 'Agregar al frasco' }).click()
  await jar.getByTestId('jar-percent').getByText('20%').waitFor()
  await page.screenshot({ path: `${OUT}/${name}-5e-frasco.png` })
  await page.getByRole('button', { name: 'Cerrar detalle' }).click()
  assert.equal(await page.getByTestId('savings-balance').textContent(), '$ 6.624,50')
  assert.equal(await page.getByTestId('savings-assigned').textContent(), '$ 200,00')
  assert.equal(await page.getByTestId('savings-available').textContent(), '$ 6.424,50')
  await nav.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 6.624,50') // ahorrar no descuenta del saldo
  log(`[${name}] Ahorros: frasco, aporte $ 200 (20%), saldo total intacto y disponible $ 6.424,50`)

  // Persistencia + bloqueo con PIN
  await page.reload()
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 6.624,50')
  await page.getByRole('button', { name: 'Más', exact: true }).click()
  await page.getByRole('button', { name: 'Bloquear DWF' }).click()
  await page.getByRole('heading', { name: 'Bienvenido de nuevo, Diego' }).waitFor()
  assert.ok(await page.getByText('+54 •••••••• 789').isVisible())
  await page.screenshot({ path: `${OUT}/${name}-6-acceso.png` })
  await pin(page, '0000')
  await page.getByText(/PIN incorrecto/).waitFor()
  await pin(page, '1234')
  await page.getByTestId('balance').waitFor()
  assert.equal(await page.getByTestId('balance').textContent(), '$ 6.624,50')
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
  await run('iphone-390', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, { mockRate: true })
  await run('iphone-375', { ...devices['iPhone X'], viewport: { width: 375, height: 812 } }, { mockRate: true })
  await run('escritorio', { viewport: { width: 1280, height: 800 } }, { mockRate: true })
  console.log('\nE2E OK')
} finally {
  await browser.close()
}
