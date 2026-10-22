import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

/** Abre la app en modo demostración saltando la bienvenida. */
export async function abrir(page: Page, ruta = '#/imprimir', { bienvenida = false } = {}) {
  if (!bienvenida) {
    await page.addInitScript(() => {
      if (!localStorage.getItem('impresora3d-ajustes'))
        localStorage.setItem('impresora3d-ajustes', JSON.stringify({ state: { bienvenidaVista: true }, version: 1 }))
    })
  }
  await page.goto(`./?demo=1${ruta}`)
}

/** Crea un modelo desde texto con el motor de demostración y abre su ficha. */
export async function crearModeloDesdeTexto(page: Page, texto = 'un tractor rojo con ruedas negras') {
  await page.getByRole('radio', { name: 'Desde texto' }).click()
  await page.getByLabel('Describe lo que quieres imprimir').fill(texto)
  await page.getByRole('button', { name: 'Crear imagen' }).click()
  await page.getByRole('button', { name: 'Crear 3D' }).click()
  await page.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })
  await expect(page).toHaveURL(/#\/modelo\//)
}

/** Imagen PNG válida (el icono de la app). */
export function pngDePrueba(): Buffer {
  return readFileSync(new URL('../public/pwa-192.png', import.meta.url))
}

/** La página no debe tener scroll horizontal. */
export async function sinDesbordeHorizontal(page: Page) {
  const anchoExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(anchoExtra, 'scroll horizontal').toBeLessThanOrEqual(1)
}
