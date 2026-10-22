/**
 * Genera los iconos de la PWA y la imagen Open Graph (vista previa de WhatsApp)
 * a partir de public/favicon.svg, usando Chromium (Playwright).
 * Uso: node scripts/generar-imagenes.mjs
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const svg = readFileSync(`${raiz}public/favicon.svg`, 'utf8')
const datos = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const pagina = await navegador.newPage()

async function captura(html, ancho, alto, salida) {
  await pagina.setViewportSize({ width: ancho, height: alto })
  await pagina.setContent(`<html><body style="margin:0">${html}</body></html>`)
  await pagina.waitForTimeout(150)
  await pagina.screenshot({ path: `${raiz}public/${salida}`, omitBackground: false })
  console.log('✔', salida)
}

const icono = (lado, relleno = 0) =>
  `<div style="width:${lado}px;height:${lado}px;background:#070914;display:grid;place-items:center"><img src="${datos}" style="width:${lado - relleno * 2}px;height:${lado - relleno * 2}px"></div>`

await captura(icono(192), 192, 192, 'pwa-192.png')
await captura(icono(512), 512, 512, 'pwa-512.png')
await captura(icono(512, 70), 512, 512, 'pwa-maskable-512.png')
await captura(icono(180), 180, 180, 'apple-touch-icon.png')

await captura(
  `<div style="width:1200px;height:630px;position:relative;overflow:hidden;font-family:system-ui,sans-serif;color:#eef1ff;
    background:radial-gradient(900px 500px at 0% 0%,rgba(34,227,255,.28),transparent 60%),radial-gradient(800px 500px at 100% 100%,rgba(255,61,216,.25),transparent 60%),#05060d">
    <img src="${datos}" style="position:absolute;right:70px;top:95px;width:440px;height:440px;border-radius:96px;box-shadow:0 0 80px rgba(34,227,255,.35)">
    <div style="position:absolute;left:80px;top:150px;width:600px">
      <div style="font-size:92px;font-weight:800;letter-spacing:-2px;line-height:1">
        <span style="background:linear-gradient(90deg,#22e3ff,#ff3dd8);-webkit-background-clip:text;color:transparent">IMPRESORA</span> 3D
      </div>
      <div style="font-size:38px;margin-top:26px;line-height:1.25;color:#cfd4f5">Convierte fotos y textos en<br>modelos 3D a todo color</div>
      <div style="display:inline-block;margin-top:34px;padding:14px 26px;border-radius:999px;font-size:28px;font-weight:700;color:#04131a;background:linear-gradient(90deg,#22e3ff,#ff3dd8)">Gratis · desde el móvil</div>
    </div>
  </div>`,
  1200,
  630,
  'og-image.png',
)
await navegador.close()
