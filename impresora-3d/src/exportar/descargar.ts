/**
 * Guardar y compartir archivos de forma compatible con el móvil.
 *  - Android: descarga normal → carpeta «Descargas».
 *  - iPhone: se abre el menú «Compartir» → «Guardar en Archivos» o «Guardar imagen» (Fotos).
 *  - Imágenes y vídeos: se pueden compartir directamente a WhatsApp, Instagram o TikTok.
 */
import { esIOS, soportaCompartirArchivos } from '../lib/plataforma'

export function nombreArchivo(nombre: string, ext: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'modelo'
  return `${base}.${ext}`
}

function descargaClasica(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Guarda un archivo. En iPhone usa el menú Compartir (la descarga directa
 * de Safari no deja elegir Archivos/Fotos y falla con formatos 3D).
 */
export async function guardarArchivo(blob: Blob, nombre: string): Promise<void> {
  const archivo = new File([blob], nombre, { type: blob.type || 'application/octet-stream' })
  if (esIOS && soportaCompartirArchivos() && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  descargaClasica(blob, nombre)
}

/** Comparte a otras apps (WhatsApp, Instagram, TikTok…). Si no se puede, descarga. */
export async function compartirArchivo(blob: Blob, nombre: string, texto?: string): Promise<'compartido' | 'descargado'> {
  const archivo = new File([blob], nombre, { type: blob.type })
  if (soportaCompartirArchivos() && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: texto })
      return 'compartido'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'compartido'
    }
  }
  descargaClasica(blob, nombre)
  return 'descargado'
}
