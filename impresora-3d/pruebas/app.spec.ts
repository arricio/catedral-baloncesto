/**
 * Pruebas de extremo a extremo de IMPRESORA 3D en móviles (360–430 px, vertical y horizontal),
 * tablet y ordenador. Motor de demostración: no usa IA real.
 */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { abrir, crearModeloDesdeTexto, pngDePrueba, sinDesbordeHorizontal } from './utilidades'

/** Los flujos largos se prueban en un Android, un iPhone y el ordenador; el resto, en todos los tamaños. */
const COMPLETOS = ['android-pixel7', 'iphone-390', 'ordenador']
const soloCompletos = (nombre: string) => test.skip(!COMPLETOS.includes(nombre), 'Flujo largo: solo en Android, iPhone y ordenador')

test('bienvenida: explica la app e indica cómo instalarla', async ({ page }) => {
  await abrir(page, '', { bienvenida: true })
  await expect(page.getByRole('heading', { name: /Bienvenido a/ })).toBeVisible()
  await expect(page.getByText(/Instálala en tu/)).toBeVisible()
  await sinDesbordeHorizontal(page)
  await page.getByRole('button', { name: 'Empezar a imprimir' }).click()
  await expect(page).toHaveURL(/#\/imprimir/)
})

test('navegación inferior con botones grandes (≥ 44 px)', async ({ page }) => {
  await abrir(page)
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  for (const nombre of ['Imprimir', 'Biblioteca', 'Ajustes']) {
    const caja = await nav.getByRole('button', { name: nombre }).boundingBox()
    expect(caja!.height).toBeGreaterThanOrEqual(44)
    expect(caja!.width).toBeGreaterThanOrEqual(44)
  }
  await nav.getByRole('button', { name: 'Biblioteca' }).click()
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible()
  await nav.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()
  await sinDesbordeHorizontal(page)
})

test('«Hacer foto» abre la cámara y «Galería» acepta solo PNG/JPG', async ({ page }) => {
  await abrir(page)
  await expect(page.locator('input[type=file][capture=environment]')).toHaveCount(1)
  const galeria = page.locator('input[type=file]:not([capture])')
  await galeria.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
  await expect(page.getByText('Solo se admiten imágenes PNG o JPG')).toBeVisible()
  await galeria.setInputFiles({ name: 'grande.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024) })
  await expect(page.getByText(/el máximo es 10 MB/)).toBeVisible()
})

test('foto → retrato en relieve (igual que la foto) con texto en la peana', async ({ page }, info) => {
  soloCompletos(info.project.name)
  await abrir(page)
  await expect(page.getByRole('radio', { name: /Relieve/ })).toHaveAttribute('aria-checked', 'true')
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'retrato.png', mimeType: 'image/png', buffer: pngDePrueba() })
  await page.getByLabel(/Texto en la peana/).fill('HOLA')
  await page.getByRole('button', { name: /Cómic/ }).click()
  await page.getByRole('button', { name: 'Imprimir en 3D' }).click()
  await page.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })
  await expect(page.getByText(/Retrato en relieve ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Guardar en el móvil' }).click()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'STL' }).click()
  expect(readFileSync((await (await descarga).path())!).length).toBeGreaterThan(10_000)
})

test('foto → modelo 3D a color → biblioteca', async ({ page }) => {
  await abrir(page)
  await page.getByRole('radio', { name: /Figura completa/ }).click()
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'coche_rojo.png', mimeType: 'image/png', buffer: pngDePrueba() })
  await expect(page.getByLabel('Nombre del modelo')).toHaveValue('coche rojo')
  await page.getByRole('button', { name: 'Imprimir en 3D' }).click()
  await expect(page.getByRole('progressbar').first()).toBeVisible()
  await expect(page.getByText(/Analizando imagen|Construyendo forma|Pintando texturas|Esperando turno/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'coche rojo' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Visor del modelo 3D/ })).toBeVisible()
  await sinDesbordeHorizontal(page)
  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).click()
  await expect(page.getByText('coche rojo')).toBeVisible()
})

test('texto → imagen intermedia (regenerar/aceptar) → 3D, y exportaciones', async ({ page }, info) => {
  soloCompletos(info.project.name)
  test.setTimeout(240_000)
  await abrir(page)
  await page.getByRole('radio', { name: 'Desde texto' }).click()
  await page.getByLabel('Describe lo que quieres imprimir').fill('un tractor rojo con ruedas negras')
  await page.getByRole('button', { name: 'Figura de juguete' }).click()
  await page.getByLabel(/Colores deseados/).fill('rojo y negro')
  await page.getByRole('button', { name: 'Crear imagen' }).click()
  await expect(page.getByRole('img', { name: /Imagen generada/ })).toBeVisible()
  await page.getByRole('button', { name: 'Otra imagen' }).click()
  await page.getByRole('button', { name: 'Crear 3D' }).click()
  await page.getByRole('button', { name: 'Ver modelo' }).click({ timeout: 60_000 })

  // Descargas 3D
  await page.getByRole('button', { name: 'Guardar en el móvil' }).click()
  for (const [formato, extension] of [['Modelo 3D (GLB)', '.glb'], ['STL', '.stl'], ['3MF a color', '.3mf'], ['Modelo 3D (OBJ con texturas)', '.zip']] as const) {
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: formato }).click()
    const d = await descarga
    expect(d.suggestedFilename()).toMatch(new RegExp(`\\${extension}$`))
    const datos = readFileSync((await d.path())!)
    expect(datos.length).toBeGreaterThan(200)
    if (extension === '.glb') expect(datos.subarray(0, 4).toString()).toBe('glTF')
    if (extension === '.3mf') {
      const zip = await JSZip.loadAsync(datos)
      const modelo = await zip.file('3D/3dmodel.model')!.async('string')
      expect(modelo).toContain('<basematerials')
      expect(modelo).toContain('unit="millimeter"')
    }
    if (extension === '.zip') {
      const zip = await JSZip.loadAsync(datos)
      expect(Object.keys(zip.files).some((n) => n.endsWith('.obj'))).toBe(true)
      expect(Object.keys(zip.files).some((n) => n.endsWith('.mtl'))).toBe(true)
      expect(Object.keys(zip.files).some((n) => n.endsWith('.png'))).toBe(true)
    }
  }
  await page.getByRole('button', { name: 'Cerrar' }).click()

  // Foto del modelo para la Galería
  await page.getByRole('button', { name: 'Guardar en el móvil' }).click()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: /Foto del modelo/ }).click()
  expect((await descarga).suggestedFilename()).toMatch(/-foto\.png$/)
  await page.getByRole('button', { name: 'Cerrar' }).click()

  // Enviar a un amigo: vídeo preparado y botón de WhatsApp
  await page.getByRole('button', { name: 'Enviar a un amigo' }).click()
  await page.getByRole('button', { name: /Foto del modelo/ }).click()
  await page.getByRole('button', { name: 'Preparar la foto' }).click()
  await expect(page.getByRole('img', { name: 'Vista previa' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeVisible()
  await page.getByRole('button', { name: /Archivo 3D/ }).click()
  const glb = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Enviar archivo 3D' }).click()
  expect((await glb).suggestedFilename()).toMatch(/\.glb$/)
  await expect(page.getByText(/Documento/)).toBeVisible()
})

test('vídeo del modelo girando (9:16)', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7', 'Solo en un proyecto (es lento con GPU por software)')
  test.setTimeout(180_000)
  await abrir(page)
  await crearModeloDesdeTexto(page, 'una taza azul')
  await page.getByRole('button', { name: 'Enviar a un amigo' }).click()
  await page.getByRole('button', { name: 'Preparar el vídeo' }).click()
  await expect(page.locator('dialog video')).toBeVisible({ timeout: 150_000 })
  await expect(page.getByText(/\d+ (KB|MB)/).last()).toBeVisible()
})

test('carpetas: crear, mover, renombrar, filtrar, buscar y borrar', async ({ page }, info) => {
  soloCompletos(info.project.name)
  await abrir(page)
  await crearModeloDesdeTexto(page, 'un dragón verde')
  await page.goto('./?demo=1#/biblioteca')
  await page.getByRole('button', { name: 'Carpeta' }).click()
  await page.getByLabel('Nombre de la carpeta').fill('Juguetes')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('tab', { name: /Juguetes/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('No hay modelos con esos filtros.')).toBeVisible()

  // Mover el modelo a «Juguetes» desde su ficha
  await page.getByRole('tab', { name: /Todas/ }).click()
  await page.getByRole('link', { name: /Un dragón verde/ }).click()
  await page.getByRole('button', { name: 'Mover' }).click()
  await page.getByLabel('Carpeta', { exact: true }).selectOption({ label: '📁 Juguetes' })
  await expect(page.getByText('Modelo movido.')).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).click()
  await page.getByRole('tab', { name: /Juguetes/ }).click()
  await expect(page.getByText('Un dragón verde')).toBeVisible()

  // Filtros y búsqueda
  await page.getByLabel('Filtrar por tipo').selectOption('foto')
  await expect(page.getByText('No hay modelos con esos filtros.')).toBeVisible()
  await page.getByLabel('Filtrar por tipo').selectOption('texto')
  await page.getByPlaceholder('Buscar por nombre o texto').fill('dragón')
  await expect(page.getByText('Un dragón verde')).toBeVisible()
  await page.getByPlaceholder('Buscar por nombre o texto').fill('nave espacial')
  await expect(page.getByText('No hay modelos con esos filtros.')).toBeVisible()
  await page.getByPlaceholder('Buscar por nombre o texto').fill('')

  // Renombrar y descargar la carpeta en ZIP
  await page.getByRole('button', { name: 'Renombrar' }).click()
  await page.getByLabel('Nombre de la carpeta').fill('Mis juguetes')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('tab', { name: /Mis juguetes/ })).toBeVisible()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar ZIP' }).click()
  const zip = await JSZip.loadAsync(readFileSync((await (await descarga).path())!))
  expect(Object.keys(zip.files).some((n) => n.endsWith('.glb'))).toBe(true)

  // Borrar la carpeta: el modelo vuelve a «Mis impresiones»
  await page.getByRole('button', { name: 'Borrar', exact: true }).click()
  await page.getByRole('button', { name: /mover modelos a «Mis impresiones»/ }).click()
  await page.getByRole('tab', { name: /Mis impresiones/ }).click()
  await expect(page.getByText('Un dragón verde')).toBeVisible()

  // Eliminar un modelo desde su papelera en la Biblioteca
  await page.getByRole('button', { name: 'Eliminar Un dragón verde' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText('Modelo eliminado.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Un dragón verde/ })).toHaveCount(0)
})

test('copia de seguridad: exportar e importar la biblioteca en ZIP', async ({ page, browser }, info) => {
  soloCompletos(info.project.name)
  await abrir(page)
  await crearModeloDesdeTexto(page, 'una lámpara amarilla')
  await page.goto('./?demo=1#/ajustes')
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar' }).click()
  const ruta = (await (await descarga).path())!

  // Otro "dispositivo" vacío importa la copia
  const otro = await browser.newPage()
  await abrir(otro, '#/ajustes')
  await otro.locator('input[type=file][accept*=zip]').setInputFiles(ruta)
  await expect(otro.getByText(/Importados 1 modelos/)).toBeVisible()
  await otro.goto('./?demo=1#/biblioteca')
  await expect(otro.getByText('Una lámpara amarilla')).toBeVisible()
  await otro.close()
})

test('sin conexión: la biblioteca y los modelos se siguen viendo', async ({ page, context }, info) => {
  test.skip(!['android-pixel7', 'iphone-390'].includes(info.project.name), 'Basta con un Android y un iPhone')
  await abrir(page)
  await crearModeloDesdeTexto(page, 'un cohete blanco')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // la página queda controlada por el Service Worker
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.goto('./?demo=1#/biblioteca')
  await expect(page.getByText('Sin conexión · tu biblioteca sigue disponible')).toBeVisible()
  await page.getByRole('link', { name: /Un cohete blanco/ }).click()
  await expect(page.getByRole('img', { name: /Visor del modelo 3D/ })).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Imprimir' }).click()
  await expect(page.getByRole('button', { name: 'Crear imagen' }).or(page.getByRole('button', { name: 'Hacer foto' }))).toBeVisible()
  await expect(page.getByText(/para imprimir hace falta internet/)).toBeVisible()
  await context.setOffline(false)
})

test('ajustes: tema claro, ahorro de datos y compartir por WhatsApp', async ({ page }) => {
  await abrir(page, '#/ajustes')
  await page.getByRole('radio', { name: 'Claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro')
  await page.getByRole('switch', { name: 'Ahorro de datos' }).click()
  await expect(page.getByRole('switch', { name: 'Ahorro de datos' })).toHaveAttribute('aria-checked', 'true')
  const wa = page.getByRole('link', { name: 'WhatsApp' })
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*impresora-3d/)
  await sinDesbordeHorizontal(page)
})

test('etiquetas Open Graph y manifiesto para instalar', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/.*og-image\.png$/)
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /IMPRESORA 3D/)
  const manifiesto = await (await request.get('./manifest.webmanifest')).json()
  expect(manifiesto.lang).toBe('es')
  expect(manifiesto.display).toBe('standalone')
  expect(manifiesto.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
})
