/**
 * Copias de seguridad y descargas en ZIP:
 *  - Exportar/importar la biblioteca completa (carpetas + modelos + imágenes).
 *  - Descargar una carpeta entera en ZIP.
 */
import JSZip from 'jszip'
import { db, ID_CARPETA_DEFECTO, nuevoId, type Carpeta, type Modelo } from '../lib/db'
import { nombreArchivo } from './descargar'

type ModeloSinBlobs = Omit<Modelo, 'imagen' | 'glb' | 'miniatura'>

interface Manifiesto {
  app: 'impresora-3d'
  version: 1
  fecha: string
  carpetas: Carpeta[]
  modelos: (ModeloSinBlobs & { archivos: { imagen: string; glb: string; miniatura: string } })[]
}

const ext = (b: Blob) => (b.type.includes('png') ? 'png' : b.type.includes('webp') ? 'webp' : 'jpg')

export async function exportarBiblioteca(alProgresar?: (p: number) => void): Promise<Blob> {
  const zip = new JSZip()
  const carpetas = await db.carpetas.toArray()
  const modelos = await db.modelos.toArray()
  const manifiesto: Manifiesto = { app: 'impresora-3d', version: 1, fecha: new Date().toISOString(), carpetas, modelos: [] }
  for (const m of modelos) {
    const { imagen, glb, miniatura, ...resto } = m
    const archivos = { imagen: `modelos/${m.id}/original.${ext(imagen)}`, glb: `modelos/${m.id}/modelo.glb`, miniatura: `modelos/${m.id}/miniatura.${ext(miniatura)}` }
    zip.file(archivos.imagen, imagen)
    zip.file(archivos.glb, glb)
    zip.file(archivos.miniatura, miniatura)
    manifiesto.modelos.push({ ...resto, archivos })
  }
  zip.file('biblioteca.json', JSON.stringify(manifiesto, null, 2))
  // Los GLB ya van comprimidos: STORE es mucho más rápido en el móvil.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => alProgresar?.(m.percent / 100))
}

/** Importa una copia. Los modelos que ya existen (mismo ID) no se duplican. */
export async function importarBiblioteca(archivo: Blob): Promise<{ modelos: number; carpetas: number }> {
  const zip = await JSZip.loadAsync(archivo)
  const texto = await zip.file('biblioteca.json')?.async('string')
  if (!texto) throw new Error('Este ZIP no es una copia de IMPRESORA 3D.')
  const man = JSON.parse(texto) as Manifiesto
  if (man.app !== 'impresora-3d') throw new Error('Este ZIP no es una copia de IMPRESORA 3D.')
  let nModelos = 0
  let nCarpetas = 0
  const tipo = (ruta: string) => (ruta.endsWith('.png') ? 'image/png' : ruta.endsWith('.webp') ? 'image/webp' : ruta.endsWith('.glb') ? 'model/gltf-binary' : 'image/jpeg')
  const leer = async (ruta: string) => new Blob([await zip.file(ruta)!.async('arraybuffer')], { type: tipo(ruta) })
  for (const c of man.carpetas) {
    if (!(await db.carpetas.get(c.id))) {
      await db.carpetas.add(c)
      nCarpetas++
    }
  }
  for (const m of man.modelos) {
    if (await db.modelos.get(m.id)) continue
    const { archivos, ...resto } = m
    const carpetaId = (await db.carpetas.get(resto.carpetaId)) ? resto.carpetaId : ID_CARPETA_DEFECTO
    await db.modelos.add({ ...resto, carpetaId, imagen: await leer(archivos.imagen), glb: await leer(archivos.glb), miniatura: await leer(archivos.miniatura) })
    nModelos++
  }
  return { modelos: nModelos, carpetas: nCarpetas }
}

/** ZIP con todos los modelos (GLB) e imágenes originales de una carpeta. */
export async function zipCarpeta(carpetaId: string): Promise<{ blob: Blob; nombre: string }> {
  const carpeta = await db.carpetas.get(carpetaId)
  const modelos = await db.modelos.where('carpetaId').equals(carpetaId).toArray()
  const zip = new JSZip()
  const usados = new Set<string>()
  for (const m of modelos) {
    let base = nombreArchivo(m.nombre, '').slice(0, -1)
    while (usados.has(base)) base = `${base}-${nuevoId().slice(0, 4)}`
    usados.add(base)
    zip.file(`${base}/${base}.glb`, m.glb)
    zip.file(`${base}/original.${ext(m.imagen)}`, m.imagen)
    if (m.prompt) zip.file(`${base}/descripcion.txt`, `${m.prompt}${m.colores ? `\nColores: ${m.colores}` : ''}`)
  }
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'STORE' }), nombre: nombreArchivo(carpeta?.nombre ?? 'carpeta', 'zip') }
}
