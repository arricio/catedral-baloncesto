/**
 * Modo B: la app contra el servidor local en MODO PRUEBA (sin GPU).
 * Arranca antes el servidor:  IMPRESORA_PRUEBA=1 IMPRESORA_CLAVE=secreta123 python servidor-local/servidor.py
 * y exporta SERVIDOR_PRUEBA=http://127.0.0.1:8188
 */
import { expect, test } from '@playwright/test'
import { pngDePrueba } from './utilidades'

const URL_SERVIDOR = process.env.SERVIDOR_PRUEBA
test.skip(!URL_SERVIDOR, 'Sin servidor local de prueba (define SERVIDOR_PRUEBA)')

async function preparar(page: import('@playwright/test').Page, clave: string, motor = 'local') {
  await page.addInitScript(
    ([url, clave, motor]) => {
      if (!localStorage.getItem('impresora3d-ajustes'))
        localStorage.setItem('impresora3d-ajustes', JSON.stringify({ state: { bienvenidaVista: true, motor, localUrl: url, localClave: clave, modoFoto: 'ia' }, version: 2 }))
    },
    [URL_SERVIDOR!, clave, motor],
  )
}

test('detecta el servidor encendido y genera el modelo en él', async ({ page }, info) => {
  test.skip(!['android-pixel7', 'iphone-390', 'ordenador'].includes(info.project.name))
  await preparar(page, 'secreta123')
  await page.goto('./#/imprimir')
  await expect(page.getByText(/Mi servidor encendido/)).toBeVisible()
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'robot.png', mimeType: 'image/png', buffer: pngDePrueba() })
  await page.getByRole('button', { name: 'Imprimir en 3D' }).click()
  await expect(page.getByText('Mi servidor').first()).toBeVisible()
  await page.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })
  await expect(page.getByText(/Mi servidor ·/)).toBeVisible()
})

test('si se cierra la app a mitad, al volver recoge el resultado del servidor', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'android-pixel7')
  await preparar(page, 'secreta123')
  await page.goto('./#/imprimir')
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'gato.png', mimeType: 'image/png', buffer: pngDePrueba() })
  await page.getByRole('button', { name: 'Imprimir en 3D' }).click()
  await expect(page.getByText(/Construyendo forma|Analizando imagen|Esperando turno/).first()).toBeVisible()
  await page.close() // «se cierra la app»
  const otra = await context.newPage()
  await otra.goto('./#/imprimir')
  await otra.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })
  await expect(otra.getByRole('heading', { name: 'gato' })).toBeVisible()
})

test('contraseña incorrecta: mensaje claro', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7')
  await preparar(page, 'mala-clave')
  await page.goto('./#/imprimir')
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: pngDePrueba() })
  await page.getByRole('button', { name: 'Imprimir en 3D' }).click()
  await expect(page.getByText('La contraseña del servidor local no es correcta. Revísala en Ajustes.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test('servidor apagado: cambia solo a la nube', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7')
  await page.addInitScript(() => {
    localStorage.setItem('impresora3d-ajustes', JSON.stringify({ state: { bienvenidaVista: true, motor: 'local', localUrl: 'http://127.0.0.1:9', localClave: 'x', modoFoto: 'ia' }, version: 2 }))
  })
  await page.goto('./#/imprimir')
  await expect(page.getByText('Servidor apagado → usando la nube')).toBeVisible()
})

test('enlace de invitación configura el servidor', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7')
  await page.addInitScript(() => localStorage.setItem('impresora3d-ajustes', JSON.stringify({ state: { bienvenidaVista: true }, version: 1 })))
  // El servidor de prueba es http (local); el enlace real siempre es https.
  await page.goto(`./#/conectar?url=${encodeURIComponent('https://ejemplo.trycloudflare.com')}&clave=abc12345`)
  await expect(page.getByText('Te han invitado a usar la impresora de su PC')).toBeVisible()
  await page.getByRole('button', { name: 'Conectar' }).click()
  const ajustes = await page.evaluate(() => JSON.parse(localStorage.getItem('impresora3d-ajustes')!).state)
  expect(ajustes.localUrl).toBe('https://ejemplo.trycloudflare.com')
  expect(ajustes.localClave).toBe('abc12345')
})
