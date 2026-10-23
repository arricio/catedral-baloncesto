/**
 * «Tu foto por delante»: la IA crea la figura completa (con nuca, cuello y espalda)
 * y aquí se pega la foto original EXACTA sobre su parte delantera, para que la cara,
 * las letras y los colores sean idénticos a la foto. La espalda sigue siendo la de la IA.
 *
 * Todo ocurre en el móvil:
 *  1. Se averigua hacia dónde mira la figura: se compara su silueta y sus colores,
 *     vista desde 4 lados, con la silueta de la foto.
 *  2. Se calcula qué partes se ven desde delante (mapa de profundidad).
 *  3. Se repinta la textura de la figura: cada punto que mira hacia delante y se ve
 *     toma el color de la foto, con un fundido suave hacia los lados.
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { cargarGLB } from '../lib/escena'
import { cargarBitmap } from '../lib/imagen'
import { calcularMascara } from './relieve'

type Vista = { nombre: string; d: THREE.Vector3; derecha: THREE.Vector3 }

/** Cámara situada en ese lado, mirando al centro. «derecha» es la derecha de la pantalla. */
const VISTAS: Vista[] = [
  { nombre: '+z', d: new THREE.Vector3(0, 0, 1), derecha: new THREE.Vector3(1, 0, 0) },
  { nombre: '-z', d: new THREE.Vector3(0, 0, -1), derecha: new THREE.Vector3(-1, 0, 0) },
  { nombre: '+x', d: new THREE.Vector3(1, 0, 0), derecha: new THREE.Vector3(0, 0, -1) },
  { nombre: '-x', d: new THREE.Vector3(-1, 0, 0), derecha: new THREE.Vector3(0, 0, 1) },
]

interface Malla {
  mesh: THREE.Mesh
  pos: Float32Array // posiciones en coordenadas del mundo
  nor: Float32Array // normales en coordenadas del mundo
  uv: Float32Array
  indice: ArrayLike<number>
  mapa: THREE.Texture
}

interface Foto {
  ancho: number
  alto: number
  px: Uint8ClampedArray
  mascara: Uint8Array // a la misma resolución que px
  caja: { x0: number; x1: number; y0: number; y1: number }
}

const esperar = () => new Promise((ok) => setTimeout(ok, 0))

function extraerMallas(raiz: THREE.Object3D): Malla[] {
  raiz.updateMatrixWorld(true)
  const lista: Malla[] = []
  raiz.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
    const g = mesh.geometry
    if (!mat?.map || !g.attributes.uv || !g.attributes.position) return
    const geo = g.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    if (!geo.attributes.normal) geo.computeVertexNormals()
    const n = geo.attributes.position.count
    const indice = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i)
    lista.push({
      mesh,
      pos: Float32Array.from(geo.attributes.position.array as ArrayLike<number>),
      nor: Float32Array.from(geo.attributes.normal.array as ArrayLike<number>),
      uv: Float32Array.from(geo.attributes.uv.array as ArrayLike<number>),
      indice,
      mapa: mat.map,
    })
  })
  return lista
}

async function leerFoto(blob: Blob, lado = 1024): Promise<Foto> {
  const bmp = await cargarBitmap(blob)
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height))
  const ancho = Math.round(bmp.width * k)
  const alto = Math.round(bmp.height * k)
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = alto
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, ancho, alto)
  g.drawImage(bmp, 0, 0, ancho, alto)
  bmp.close()
  const px = g.getImageData(0, 0, ancho, alto).data
  const mascara = calcularMascara(px, ancho, alto)
  let x0 = ancho, x1 = 0, y0 = alto, y1 = 0
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++)
      if (mascara[y * ancho + x]) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x + 1)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y + 1)
      }
  return { ancho, alto, px, mascara, caja: { x0, x1, y0, y1 } }
}

/** Píxeles de la textura (para comparar colores y repintar). */
function pixelesDe(t: THREE.Texture, maxLado = 2048): { lienzo: HTMLCanvasElement; datos: ImageData } {
  const img = t.image as CanvasImageSource & { width: number; height: number }
  const k = Math.min(1, maxLado / Math.max(img.width, img.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(img.width * k))
  lienzo.height = Math.max(1, Math.round(img.height * k))
  const g = lienzo.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, lienzo.width, lienzo.height)
  return { lienzo, datos: g.getImageData(0, 0, lienzo.width, lienzo.height) }
}

/** Límites de la figura vista desde un lado (en coordenadas de pantalla). */
function limitesVista(mallas: Malla[], v: Vista) {
  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity
  for (const m of mallas)
    for (let i = 0; i < m.pos.length; i += 3) {
      const sx = m.pos[i] * v.derecha.x + m.pos[i + 1] * v.derecha.y + m.pos[i + 2] * v.derecha.z
      const sy = m.pos[i + 1]
      sx0 = Math.min(sx0, sx)
      sx1 = Math.max(sx1, sx)
      sy0 = Math.min(sy0, sy)
      sy1 = Math.max(sy1, sy)
    }
  return { sx0, sx1, sy0, sy1 }
}

/**
 * Dibuja la figura vista desde un lado en una rejilla N×N: profundidad, y qué
 * malla/triángulo/baricéntricas se ven en cada celda.
 */
function rasterizar(mallas: Malla[], v: Vista, N: number, lim: ReturnType<typeof limitesVista>) {
  const prof = new Float32Array(N * N).fill(-Infinity)
  const quien = new Int32Array(N * N).fill(-1) // índice de malla
  const tri = new Int32Array(N * N).fill(-1)
  const bA = new Float32Array(N * N)
  const bB = new Float32Array(N * N)
  const escX = (N - 1) / (lim.sx1 - lim.sx0 || 1)
  const escY = (N - 1) / (lim.sy1 - lim.sy0 || 1)
  const P = (m: Malla, k: number) => {
    const x = m.pos[k * 3], y = m.pos[k * 3 + 1], z = m.pos[k * 3 + 2]
    return [
      (x * v.derecha.x + y * v.derecha.y + z * v.derecha.z - lim.sx0) * escX,
      (lim.sy1 - y) * escY, // la pantalla crece hacia abajo
      x * v.d.x + y * v.d.y + z * v.d.z, // más grande = más cerca de la cámara
    ]
  }
  mallas.forEach((m, mi) => {
    for (let t = 0; t < m.indice.length; t += 3) {
      const [ax, ay, az] = P(m, m.indice[t])
      const [bx, by, bz] = P(m, m.indice[t + 1])
      const [cx, cy, cz] = P(m, m.indice[t + 2])
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
      if (Math.abs(area) < 1e-9) continue
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
      const x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx)))
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)))
      const y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)))
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const w0 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / area
          const w1 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / area
          const w2 = 1 - w0 - w1
          if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue
          const z = w0 * az + w1 * bz + w2 * cz
          const k = y * N + x
          if (z > prof[k]) {
            prof[k] = z
            quien[k] = mi
            tri[k] = t
            bA[k] = w0
            bB[k] = w1
          }
        }
    }
  })
  return { prof, quien, tri, bA, bB, escX, escY }
}

/** ¿Qué lado de la figura corresponde a la foto? (silueta + colores) */
function elegirVista(mallas: Malla[], foto: Foto, texturas: ImageData[]): Vista {
  const N = 96
  // Silueta de la foto en una rejilla N×N (recortada a su caja)
  const { x0, x1, y0, y1 } = foto.caja
  const fw = x1 - x0
  const fh = y1 - y0
  let mejor = VISTAS[0]
  let mejorPuntos = -Infinity
  for (const v of VISTAS) {
    const lim = limitesVista(mallas, v)
    const r = rasterizar(mallas, v, N, lim)
    const aspectoModelo = (lim.sx1 - lim.sx0) / (lim.sy1 - lim.sy0 || 1)
    const aspectoFoto = fw / (fh || 1)
    let inter = 0
    let union = 0
    let difColor = 0
    let nColor = 0
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const fx = Math.min(foto.ancho - 1, Math.floor(x0 + ((x + 0.5) / N) * fw))
        const fy = Math.min(foto.alto - 1, Math.floor(y0 + ((y + 0.5) / N) * fh))
        const enFoto = foto.mascara[fy * foto.ancho + fx] === 1
        const k = y * N + x
        const enModelo = r.quien[k] >= 0
        if (enFoto && enModelo) inter++
        if (enFoto || enModelo) union++
        if (enFoto && enModelo) {
          // color de la figura en ese punto
          const m = mallas[r.quien[k]]
          const t = r.tri[k]
          const ia = m.indice[t], ib = m.indice[t + 1], ic = m.indice[t + 2]
          const w0 = r.bA[k], w1 = r.bB[k], w2 = 1 - w0 - w1
          const u = w0 * m.uv[ia * 2] + w1 * m.uv[ib * 2] + w2 * m.uv[ic * 2]
          const vv = w0 * m.uv[ia * 2 + 1] + w1 * m.uv[ib * 2 + 1] + w2 * m.uv[ic * 2 + 1]
          const tex = texturas[r.quien[k]]
          const tx = Math.min(tex.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * tex.width)))
          const ty = Math.min(tex.height - 1, Math.max(0, Math.floor((vv - Math.floor(vv)) * tex.height)))
          const i = (ty * tex.width + tx) * 4
          const j = (fy * foto.ancho + fx) * 4
          difColor += Math.abs(tex.data[i] - foto.px[j]) + Math.abs(tex.data[i + 1] - foto.px[j + 1]) + Math.abs(tex.data[i + 2] - foto.px[j + 2])
          nColor++
        }
      }
    const iou = inter / (union || 1)
    const color = nColor ? difColor / nColor / 765 : 1
    const puntos = iou - 0.6 * color - 0.5 * Math.abs(Math.log(aspectoModelo / aspectoFoto))
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos
      mejor = v
    }
  }
  return mejor
}

export async function proyectarFotoDelante(glb: Blob, foto: Blob, alProgresar?: (p: number) => void): Promise<Blob> {
  const escena = await cargarGLB(glb)
  const mallas = extraerMallas(escena)
  if (!mallas.length) throw new Error('El modelo no tiene textura donde pintar la foto.')
  const datosFoto = await leerFoto(foto)
  const { caja } = datosFoto
  if (caja.x1 <= caja.x0 || caja.y1 <= caja.y0) throw new Error('No se distingue la figura en la foto.')
  alProgresar?.(0.1)

  // Una copia editable de cada textura (las mallas pueden compartirla)
  const porTextura = new Map<THREE.Texture, { lienzo: HTMLCanvasElement; datos: ImageData }>()
  for (const m of mallas) if (!porTextura.has(m.mapa)) porTextura.set(m.mapa, pixelesDe(m.mapa))
  const texturas = mallas.map((m) => porTextura.get(m.mapa)!.datos)

  const vista = elegirVista(mallas, datosFoto, texturas)
  await esperar()
  alProgresar?.(0.3)

  // Mapa de profundidad fino desde delante
  const N = 640
  const lim = limitesVista(mallas, vista)
  const r = rasterizar(mallas, vista, N, lim)
  const tamaño = Math.max(lim.sx1 - lim.sx0, lim.sy1 - lim.sy0)
  const tolerancia = tamaño * 0.012
  await esperar()
  alProgresar?.(0.5)

  const fw = caja.x1 - caja.x0
  const fh = caja.y1 - caja.y0
  const dx = vista.d.x, dy = vista.d.y, dz = vista.d.z
  const rx = vista.derecha.x, ry = vista.derecha.y, rz = vista.derecha.z

  // Qué píxeles de cada textura pertenecen a algún triángulo (el resto es «relleno» entre piezas)
  const marcas = new Map<ImageData, { pintado: Uint8Array; cubierto: Uint8Array }>()
  for (let mi = 0; mi < mallas.length; mi++) {
    const tex = texturas[mi]
    if (!marcas.has(tex)) marcas.set(tex, { pintado: new Uint8Array(tex.width * tex.height), cubierto: new Uint8Array(tex.width * tex.height) })
    const { cubierto } = marcas.get(tex)!
    const m = mallas[mi]
    for (let t = 0; t < m.indice.length; t += 3) {
      const ia = m.indice[t], ib = m.indice[t + 1], ic = m.indice[t + 2]
      const ua = m.uv[ia * 2] * tex.width, va = m.uv[ia * 2 + 1] * tex.height
      const ub = m.uv[ib * 2] * tex.width, vb = m.uv[ib * 2 + 1] * tex.height
      const uc = m.uv[ic * 2] * tex.width, vc = m.uv[ic * 2 + 1] * tex.height
      const area = (ub - ua) * (vc - va) - (uc - ua) * (vb - va)
      if (Math.abs(area) < 1e-9) continue
      const x0 = Math.max(0, Math.floor(Math.min(ua, ub, uc)))
      const x1 = Math.min(tex.width - 1, Math.ceil(Math.max(ua, ub, uc)))
      const y0 = Math.max(0, Math.floor(Math.min(va, vb, vc)))
      const y1 = Math.min(tex.height - 1, Math.ceil(Math.max(va, vb, vc)))
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const w0 = ((ub - x - 0.5) * (vc - y - 0.5) - (uc - x - 0.5) * (vb - y - 0.5)) / area
          const w1 = ((uc - x - 0.5) * (va - y - 0.5) - (ua - x - 0.5) * (vc - y - 0.5)) / area
          if (w0 >= -0.01 && w1 >= -0.01 && 1 - w0 - w1 >= -0.01) cubierto[y * tex.width + x] = 1
        }
    }
  }
  await esperar()

  // Repintar la textura de cada malla
  for (let mi = 0; mi < mallas.length; mi++) {
    const m = mallas[mi]
    const tex = texturas[mi]
    const TW = tex.width
    const TH = tex.height
    const d = tex.data
    const pintado = marcas.get(tex)!.pintado
    for (let t = 0; t < m.indice.length; t += 3) {
      const ia = m.indice[t], ib = m.indice[t + 1], ic = m.indice[t + 2]
      // Si el triángulo entero mira hacia atrás, se salta (rápido).
      const nAx = m.nor[ia * 3] * dx + m.nor[ia * 3 + 1] * dy + m.nor[ia * 3 + 2] * dz
      const nBx = m.nor[ib * 3] * dx + m.nor[ib * 3 + 1] * dy + m.nor[ib * 3 + 2] * dz
      const nCx = m.nor[ic * 3] * dx + m.nor[ic * 3 + 1] * dy + m.nor[ic * 3 + 2] * dz
      if (nAx <= 0.05 && nBx <= 0.05 && nCx <= 0.05) continue
      const ua = m.uv[ia * 2] * TW, va = m.uv[ia * 2 + 1] * TH
      const ub = m.uv[ib * 2] * TW, vb = m.uv[ib * 2 + 1] * TH
      const uc = m.uv[ic * 2] * TW, vc = m.uv[ic * 2 + 1] * TH
      const area = (ub - ua) * (vc - va) - (uc - ua) * (vb - va)
      if (Math.abs(area) < 1e-9) continue
      const x0 = Math.max(0, Math.floor(Math.min(ua, ub, uc)))
      const x1 = Math.min(TW - 1, Math.ceil(Math.max(ua, ub, uc)))
      const y0 = Math.max(0, Math.floor(Math.min(va, vb, vc)))
      const y1 = Math.min(TH - 1, Math.ceil(Math.max(va, vb, vc)))
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const cxp = x + 0.5
          const cyp = y + 0.5
          const w0 = ((ub - cxp) * (vc - cyp) - (uc - cxp) * (vb - cyp)) / area
          const w1 = ((uc - cxp) * (va - cyp) - (ua - cxp) * (vc - cyp)) / area
          const w2 = 1 - w0 - w1
          // un poco de margen para no dejar costuras sin pintar
          if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue
          const orient = w0 * nAx + w1 * nBx + w2 * nCx
          if (orient <= 0.08) continue
          const px = w0 * m.pos[ia * 3] + w1 * m.pos[ib * 3] + w2 * m.pos[ic * 3]
          const py = w0 * m.pos[ia * 3 + 1] + w1 * m.pos[ib * 3 + 1] + w2 * m.pos[ic * 3 + 1]
          const pz = w0 * m.pos[ia * 3 + 2] + w1 * m.pos[ib * 3 + 2] + w2 * m.pos[ic * 3 + 2]
          // ¿Se ve desde delante? (nada delante en el mapa de profundidad)
          const sx = (px * rx + py * ry + pz * rz - lim.sx0) * r.escX
          const sy = (lim.sy1 - py) * r.escY
          const k = Math.min(N - 1, Math.max(0, Math.round(sy))) * N + Math.min(N - 1, Math.max(0, Math.round(sx)))
          const z = px * dx + py * dy + pz * dz
          if (r.prof[k] - z > tolerancia) continue
          // Punto correspondiente en la foto
          const fx = Math.floor(caja.x0 + (sx / (N - 1)) * fw)
          const fy = Math.floor(caja.y0 + (sy / (N - 1)) * fh)
          if (fx < 0 || fy < 0 || fx >= datosFoto.ancho || fy >= datosFoto.alto) continue
          if (!datosFoto.mascara[fy * datosFoto.ancho + fx]) continue
          // Fundido suave: de frente, la foto; de canto, la textura de la IA.
          const peso = Math.min(1, (orient - 0.08) / 0.32)
          const j = (fy * datosFoto.ancho + fx) * 4
          const i = (y * TW + x) * 4
          pintado[y * TW + x] = 1
          d[i] = d[i] + (datosFoto.px[j] - d[i]) * peso
          d[i + 1] = d[i + 1] + (datosFoto.px[j + 1] - d[i + 1]) * peso
          d[i + 2] = d[i + 2] + (datosFoto.px[j + 2] - d[i + 2]) * peso
        }
      if (t % 30000 === 0) {
        alProgresar?.(0.5 + 0.4 * (t / m.indice.length))
        await esperar()
      }
    }
  }

  // Costuras: el relleno entre piezas de la textura junto a zonas con foto toma el color de la foto
  // (si no, al mostrarlo se cuelan rayas oscuras del color antiguo).
  for (const [tex, { pintado, cubierto }] of marcas) {
    const W = tex.width
    const H = tex.height
    const d = tex.data
    for (let paso = 0; paso < 4; paso++) {
      const nuevos: number[] = []
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const k = y * W + x
          if (cubierto[k] || pintado[k]) continue
          let r = 0, g = 0, b = 0, n = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
              const kk = yy * W + xx
              if (!pintado[kk]) continue
              r += d[kk * 4]
              g += d[kk * 4 + 1]
              b += d[kk * 4 + 2]
              n++
            }
          if (n) nuevos.push(k, r / n, g / n, b / n)
        }
      for (let i = 0; i < nuevos.length; i += 4) {
        const k = nuevos[i]
        d[k * 4] = nuevos[i + 1]
        d[k * 4 + 1] = nuevos[i + 2]
        d[k * 4 + 2] = nuevos[i + 3]
        pintado[k] = 1
      }
      await esperar()
    }
  }

  // Sustituir las texturas por las repintadas
  const nuevas = new Map<THREE.Texture, THREE.Texture>()
  for (const [vieja, { lienzo, datos }] of porTextura) {
    lienzo.getContext('2d')!.putImageData(datos, 0, 0)
    const t = new THREE.CanvasTexture(lienzo)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = vieja.flipY
    t.wrapS = vieja.wrapS
    t.wrapT = vieja.wrapT
    t.userData.mimeType = 'image/jpeg'
    nuevas.set(vieja, t)
  }
  for (const m of mallas) {
    const mats = Array.isArray(m.mesh.material) ? m.mesh.material : [m.mesh.material]
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      if (!mat.map || !nuevas.has(mat.map)) continue
      const t = nuevas.get(mat.map)!
      mat.map = t
      mat.metalness = 0
      mat.metalnessMap = null
      mat.roughness = 0.85
      mat.emissiveMap = t
      mat.emissive = new THREE.Color(0xffffff)
      mat.emissiveIntensity = 0.18
    }
  }
  alProgresar?.(0.95)
  const salida = (await new GLTFExporter().parseAsync(escena, { binary: true })) as ArrayBuffer
  return new Blob([salida], { type: 'model/gltf-binary' })
}
