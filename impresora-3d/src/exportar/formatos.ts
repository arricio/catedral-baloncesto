/**
 * Conversión de modelos 3D en el navegador (sin servidor):
 *   GLB/glTF (+texturas) · OBJ + MTL + texturas (ZIP) · STL · 3MF a color
 */
import * as THREE from 'three'
import JSZip from 'jszip'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { cargarGLB, normalizar } from '../lib/escena'

export type Formato = 'glb' | 'gltf' | 'obj' | 'stl' | '3mf'

export const FORMATOS: { id: Formato; nombre: string; uso: string; ext: string }[] = [
  { id: 'glb', nombre: 'GLB', uso: 'Unity, Godot, Unreal, web y redes (con colores)', ext: 'glb' },
  { id: 'gltf', nombre: 'glTF', uso: 'Formato abierto editable (ZIP con texturas)', ext: 'zip' },
  { id: 'obj', nombre: 'OBJ + MTL', uso: 'Blender, Maya, 3ds Max (ZIP con texturas)', ext: 'zip' },
  { id: 'stl', nombre: 'STL', uso: 'Impresión 3D en un color', ext: 'stl' },
  { id: '3mf', nombre: '3MF a color', uso: 'Impresión 3D multicolor (Bambu, Prusa)', ext: '3mf' },
]

/** Recorre las mallas con su geometría ya transformada al espacio mundo (no indexada). */
function mallasMundo(raiz: THREE.Object3D): { geo: THREE.BufferGeometry; material: THREE.Material; nombre: string }[] {
  raiz.updateMatrixWorld(true)
  const lista: { geo: THREE.BufferGeometry; material: THREE.Material; nombre: string }[] = []
  raiz.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    let geo = m.geometry.clone()
    geo.applyMatrix4(m.matrixWorld)
    if (geo.index) geo = geo.toNonIndexed()
    if (!geo.attributes.normal) geo.computeVertexNormals()
    const material = Array.isArray(m.material) ? m.material[0] : m.material
    lista.push({ geo, material, nombre: m.name || `malla${lista.length}` })
  })
  return lista
}

/** Imagen de la textura base (color) de un material, como lienzo 2D. */
function lienzoTextura(material: THREE.Material): HTMLCanvasElement | null {
  const mapa = (material as THREE.MeshStandardMaterial).map
  const img = mapa?.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img || !img.width) return null
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0)
  return c
}

const aPNG = (c: HTMLCanvasElement) => new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/png'))

// ── glTF (JSON + texturas en ZIP) ───────────────────────────

async function exportarGLTF(modelo: THREE.Object3D, nombre: string): Promise<Blob> {
  const json = (await new GLTFExporter().parseAsync(modelo, { binary: false })) as Record<string, unknown>
  const zip = new JSZip()
  zip.file(`${nombre}.gltf`, JSON.stringify(json, null, 1))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

// ── OBJ + MTL + texturas ───────────────────────────────────

async function exportarOBJ(modelo: THREE.Object3D, nombre: string): Promise<Blob> {
  const zip = new JSZip()
  const mallas = mallasMundo(modelo)
  const obj: string[] = [`# IMPRESORA 3D`, `mtllib ${nombre}.mtl`]
  const mtl: string[] = ['# IMPRESORA 3D']
  let base = 1
  for (let i = 0; i < mallas.length; i++) {
    const { geo, material } = mallas[i]
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    const nor = geo.attributes.normal
    const mat = `material${i}`
    obj.push(`o parte${i}`, `usemtl ${mat}`)
    for (let v = 0; v < pos.count; v++) obj.push(`v ${pos.getX(v).toFixed(5)} ${pos.getY(v).toFixed(5)} ${pos.getZ(v).toFixed(5)}`)
    // glTF tiene el origen UV arriba; OBJ abajo → se invierte V.
    if (uv) for (let v = 0; v < uv.count; v++) obj.push(`vt ${uv.getX(v).toFixed(5)} ${(1 - uv.getY(v)).toFixed(5)}`)
    for (let v = 0; v < nor.count; v++) obj.push(`vn ${nor.getX(v).toFixed(4)} ${nor.getY(v).toFixed(4)} ${nor.getZ(v).toFixed(4)}`)
    for (let f = 0; f < pos.count; f += 3) {
      const a = base + f
      const c = (k: number) => (uv ? `${a + k}/${a + k}/${a + k}` : `${a + k}//${a + k}`)
      obj.push(`f ${c(0)} ${c(1)} ${c(2)}`)
    }
    base += pos.count
    const std = material as THREE.MeshStandardMaterial
    const color = std.color ?? new THREE.Color(1, 1, 1)
    mtl.push(`newmtl ${mat}`, `Kd ${color.r.toFixed(4)} ${color.g.toFixed(4)} ${color.b.toFixed(4)}`, 'Ka 0 0 0', 'Ks 0.1 0.1 0.1', 'd 1', 'illum 2')
    const tex = lienzoTextura(material)
    if (tex) {
      const archivo = `${nombre}_textura${i}.png`
      zip.file(archivo, await aPNG(tex))
      mtl.push(`map_Kd ${archivo}`)
    }
  }
  zip.file(`${nombre}.obj`, obj.join('\n'))
  zip.file(`${nombre}.mtl`, mtl.join('\n'))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

// ── STL (impresión en un color) ─────────────────────────────

function exportarSTL(modelo: THREE.Object3D, alturaMM: number): Blob {
  const copia = modelo.clone(true)
  escalarAMilimetros(copia, alturaMM)
  // Las impresoras usan Z hacia arriba; three.js usa Y: giramos un grupo contenedor.
  const grupo = new THREE.Group()
  grupo.add(copia)
  grupo.rotation.x = Math.PI / 2
  grupo.updateMatrixWorld(true)
  const datos = new STLExporter().parse(grupo, { binary: true }) as DataView
  return new Blob([datos.buffer as ArrayBuffer], { type: 'model/stl' })
}

function escalarAMilimetros(obj: THREE.Object3D, alturaMM: number) {
  normalizar(obj, 1)
  const caja = new THREE.Box3().setFromObject(obj)
  const alto = caja.max.y - caja.min.y || 1
  obj.scale.multiplyScalar(alturaMM / alto)
  obj.updateMatrixWorld(true)
}

// ── 3MF a color ─────────────────────────────────────────────

/**
 * 3MF con un color por triángulo (extensión «basematerials», que entienden
 * Bambu Studio, PrusaSlicer, Orca y Cura). El color se toma de la textura
 * en el centro de cada triángulo y se reduce a una paleta de pocos colores
 * para que el laminador pueda asignar filamentos.
 */
async function exportar3MF(modelo: THREE.Object3D, alturaMM: number, maxColores = 8): Promise<Blob> {
  const copia = modelo.clone(true)
  escalarAMilimetros(copia, alturaMM)
  const mallas = mallasMundo(copia)

  // 1) Color medio de cada triángulo.
  const coloresTri: number[] = []
  const verts: number[] = []
  for (const { geo, material } of mallas) {
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    const col = geo.attributes.color
    const tex = lienzoTextura(material)
    const ctx = tex?.getContext('2d', { willReadFrequently: true })
    const pix = ctx ? ctx.getImageData(0, 0, tex!.width, tex!.height).data : null
    const base = (material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0.8, 0.8, 0.8)
    for (let f = 0; f < pos.count; f += 3) {
      for (let k = 0; k < 3; k++) verts.push(pos.getX(f + k), -pos.getZ(f + k), pos.getY(f + k)) // Y-arriba → Z-arriba
      let r = base.r, g = base.g, b = base.b
      if (pix && uv) {
        const u = (uv.getX(f) + uv.getX(f + 1) + uv.getX(f + 2)) / 3
        const v = (uv.getY(f) + uv.getY(f + 1) + uv.getY(f + 2)) / 3
        const x = Math.min(tex!.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * tex!.width)))
        const y = Math.min(tex!.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * tex!.height)))
        const i = (y * tex!.width + x) * 4
        r = (pix[i] / 255) * base.r; g = (pix[i + 1] / 255) * base.g; b = (pix[i + 2] / 255) * base.b
      } else if (col) {
        r = (col.getX(f) + col.getX(f + 1) + col.getX(f + 2)) / 3
        g = (col.getY(f) + col.getY(f + 1) + col.getY(f + 2)) / 3
        b = (col.getZ(f) + col.getZ(f + 1) + col.getZ(f + 2)) / 3
      }
      coloresTri.push(r, g, b)
    }
  }

  // 2) Paleta reducida con k-medias sencillo.
  const n = coloresTri.length / 3
  const k = Math.min(maxColores, n)
  const centros: number[] = []
  for (let i = 0; i < k; i++) {
    const j = Math.floor(((i + 0.5) / k) * n) * 3
    centros.push(coloresTri[j], coloresTri[j + 1], coloresTri[j + 2])
  }
  const asignacion = new Uint8Array(n)
  for (let iter = 0; iter < 8; iter++) {
    const suma = new Float64Array(k * 4)
    for (let t = 0; t < n; t++) {
      let mejor = 0, dMin = Infinity
      for (let c = 0; c < k; c++) {
        const dr = coloresTri[t * 3] - centros[c * 3], dg = coloresTri[t * 3 + 1] - centros[c * 3 + 1], db = coloresTri[t * 3 + 2] - centros[c * 3 + 2]
        const d = dr * dr + dg * dg + db * db
        if (d < dMin) { dMin = d; mejor = c }
      }
      asignacion[t] = mejor
      suma[mejor * 4] += coloresTri[t * 3]; suma[mejor * 4 + 1] += coloresTri[t * 3 + 1]; suma[mejor * 4 + 2] += coloresTri[t * 3 + 2]; suma[mejor * 4 + 3]++
    }
    for (let c = 0; c < k; c++) if (suma[c * 4 + 3]) for (let q = 0; q < 3; q++) centros[c * 3 + q] = suma[c * 4 + q] / suma[c * 4 + 3]
  }
  const hex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0').toUpperCase()

  // 3) Fusionar vértices repetidos (malla cerrada = mejor laminado).
  const mapa = new Map<string, number>()
  const vertTxt: string[] = []
  const indices: number[] = []
  for (let i = 0; i < verts.length; i += 3) {
    const clave = `${verts[i].toFixed(4)},${verts[i + 1].toFixed(4)},${verts[i + 2].toFixed(4)}`
    let idx = mapa.get(clave)
    if (idx === undefined) {
      idx = vertTxt.length
      mapa.set(clave, idx)
      vertTxt.push(`<vertex x="${verts[i].toFixed(4)}" y="${verts[i + 1].toFixed(4)}" z="${verts[i + 2].toFixed(4)}"/>`)
    }
    indices.push(idx)
  }
  // Apoyar en z=0 (la cama de la impresora).
  const triTxt: string[] = []
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]
    if (a === b || b === c || a === c) continue
    triTxt.push(`<triangle v1="${a}" v2="${b}" v3="${c}" pid="1" p1="${asignacion[t]}"/>`)
  }
  const materiales = Array.from({ length: k }, (_, c) => `<base name="Color ${c + 1}" displaycolor="#${hex(centros[c * 3])}${hex(centros[c * 3 + 1])}${hex(centros[c * 3 + 2])}FF"/>`)

  const modeloXML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">IMPRESORA 3D</metadata>
 <resources>
  <basematerials id="1">${materiales.join('')}</basematerials>
  <object id="2" type="model" pid="1" pindex="0">
   <mesh>
    <vertices>${vertTxt.join('')}</vertices>
    <triangles>${triTxt.join('')}</triangles>
   </mesh>
  </object>
 </resources>
 <build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></build>
</model>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`)
  zip.file('3D/3dmodel.model', modeloXML)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'model/3mf' })
}

// ── Punto de entrada ────────────────────────────────────────

export interface OpcionesExportar {
  /** Altura final para impresión 3D (STL/3MF), en milímetros. */
  alturaMM?: number
  /** Número de colores del 3MF (filamentos). */
  colores3MF?: number
}

export async function exportarModelo(glb: Blob, formato: Formato, nombre: string, op: OpcionesExportar = {}): Promise<Blob> {
  if (formato === 'glb') return glb.type ? glb : new Blob([glb], { type: 'model/gltf-binary' })
  const modelo = await cargarGLB(glb)
  const base = nombre.replace(/\.[^.]+$/, '')
  switch (formato) {
    case 'gltf':
      return exportarGLTF(modelo, base)
    case 'obj':
      return exportarOBJ(modelo, base)
    case 'stl':
      return exportarSTL(modelo, op.alturaMM ?? 80)
    case '3mf':
      return exportar3MF(modelo, op.alturaMM ?? 80, op.colores3MF ?? 8)
  }
}

/** Convierte un OBJ (con colores por vértice, si los trae) en un GLB. */
export async function objAGlb(texto: string): Promise<Blob> {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
  const grupo = new OBJLoader().parse(texto)
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals()
    m.material = new THREE.MeshStandardMaterial({ vertexColors: !!m.geometry.attributes.color, roughness: 0.75, metalness: 0 })
  })
  const glb = (await new GLTFExporter().parseAsync(grupo, { binary: true })) as ArrayBuffer
  return new Blob([glb], { type: 'model/gltf-binary' })
}
