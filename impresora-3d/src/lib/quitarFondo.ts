/**
 * Eliminación de fondo DENTRO del navegador (gratis y privado: la foto no sale del móvil).
 * Usa transformers.js con el modelo RMBG-1.4 cuantizado (~45 MB, se descarga una sola vez
 * y queda en la caché del navegador). Licencia del modelo: uso no comercial.
 * Si falla (móvil antiguo, sin memoria), se devuelve la imagen original y el
 * servicio 3D quita el fondo en el servidor.
 */
import { cargarBitmap } from './imagen'

type Segmentador = (img: unknown) => Promise<{ toBlob: (tipo?: string) => Promise<Blob> }>
let segmentador: Promise<Segmentador> | null = null

async function obtener(alProgresar?: (p: number) => void): Promise<Segmentador> {
  segmentador ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers')
    const p = await pipeline('background-removal', 'briaai/RMBG-1.4', {
      dtype: 'q8',
      progress_callback: (e: { status: string; progress?: number }) => {
        if (e.status === 'progress' && e.progress != null) alProgresar?.(e.progress)
      },
    })
    return p as unknown as Segmentador
  })()
  segmentador.catch(() => (segmentador = null))
  return segmentador
}

export async function quitarFondoEnNavegador(imagen: Blob, alProgresar?: (p: number) => void): Promise<Blob> {
  const seg = await obtener(alProgresar)
  // transformers.js acepta una URL; usamos un objeto URL temporal.
  const bmp = await cargarBitmap(imagen)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  const url = c.toDataURL('image/png')
  const salida = await seg(url)
  return salida.toBlob('image/png')
}
