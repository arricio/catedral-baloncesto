/**
 * Utilidades de imagen: validación, compresión (ahorro de datos) y miniaturas.
 */
import { EXTENSIONES_PERMITIDAS, TIPOS_IMAGEN_PERMITIDOS } from './config'

export class ErrorImagen extends Error {}

/** Comprueba que el archivo sea PNG o JPG/JPEG y no supere el tamaño máximo. */
export function validarImagen(archivo: File, maxMB: number): void {
  const nombre = archivo.name.toLowerCase()
  const tipoOk = (TIPOS_IMAGEN_PERMITIDOS as readonly string[]).includes(archivo.type)
  const extOk = EXTENSIONES_PERMITIDAS.some((e) => nombre.endsWith(e))
  if (!tipoOk && !extOk) {
    throw new ErrorImagen('Solo se admiten imágenes PNG o JPG. Prueba con otra foto.')
  }
  if (archivo.size > maxMB * 1024 * 1024) {
    throw new ErrorImagen(
      `La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${maxMB} MB. Elige una más pequeña o cambia el límite en Ajustes.`,
    )
  }
}

export async function cargarBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    // "from-image" respeta la orientación EXIF de las fotos del móvil.
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    throw new ErrorImagen('No se ha podido leer la imagen. ¿Está dañada?')
  }
}

function lienzo(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const aBlob = (c: HTMLCanvasElement, tipo: string, calidad?: number) =>
  new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new ErrorImagen('No se pudo procesar la imagen.'))), tipo, calidad))

/** ¿Tiene la imagen píxeles transparentes? (p. ej. fondo ya quitado) */
function tieneTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const datos = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < datos.length; i += 16) if (datos[i] < 250) return true
  return false
}

/**
 * Redimensiona y comprime antes de enviar.
 * Con ahorro de datos: lado máximo 768 px y JPEG al 80 %. Sin él: 1024 px y 92 %.
 * Si la imagen tiene transparencia se mantiene en PNG para no perderla.
 */
export async function comprimirImagen(blob: Blob, ahorroDatos: boolean): Promise<Blob> {
  const max = ahorroDatos ? 768 : 1024
  const bmp = await cargarBitmap(blob)
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * escala)
  const h = Math.round(bmp.height * escala)
  const c = lienzo(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  if (blob.type === 'image/png' && tieneTransparencia(ctx, w, h)) return aBlob(c, 'image/png')
  return aBlob(c, 'image/jpeg', ahorroDatos ? 0.8 : 0.92)
}

/** Miniatura cuadrada en WebP/JPEG para la biblioteca. */
export async function crearMiniatura(fuente: Blob | HTMLCanvasElement, lado = 320): Promise<Blob> {
  let img: CanvasImageSource
  let w: number
  let h: number
  if (fuente instanceof Blob) {
    const bmp = await cargarBitmap(fuente)
    img = bmp
    w = bmp.width
    h = bmp.height
  } else {
    img = fuente
    w = fuente.width
    h = fuente.height
  }
  const c = lienzo(lado, lado)
  const ctx = c.getContext('2d')!
  const escala = Math.min(lado / w, lado / h)
  const dw = w * escala
  const dh = h * escala
  ctx.drawImage(img, (lado - dw) / 2, (lado - dh) / 2, dw, dh)
  const webp = await aBlob(c, 'image/webp', 0.85).catch(() => null)
  return webp && webp.type === 'image/webp' ? webp : aBlob(c, 'image/jpeg', 0.85)
}

export const urlDeBlob = (b: Blob) => URL.createObjectURL(b)
