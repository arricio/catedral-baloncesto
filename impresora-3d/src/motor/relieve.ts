/**
 * «Retrato en relieve»: convierte una foto en una figura 3D con volumen que lleva
 * la foto EXACTA por delante (cara, letras y colores idénticos). Todo se calcula
 * en el propio móvil, en segundos, sin IA en la nube y sin gastar cupo.
 *
 *  1. Separa la figura del fondo (transparencia de la imagen, o fondo liso detectado
 *     desde los bordes). Si no se puede, hace una placa rectangular.
 *  2. Da volumen redondeado a la silueta (más grueso en el centro, fino en los bordes)
 *     con un poco de detalle según la luz de la foto.
 *  3. Construye una pieza cerrada (sirve para impresoras 3D) y, si se pide, una peana
 *     con un texto en el tipo de letra elegido.
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { cargarBitmap } from '../lib/imagen'
import { cargarFuente, fuentePorId } from '../lib/fuentes'
import type { AlProgresar } from './tipos'

export interface OpcionesRelieve {
  /** 0 = casi plano, 1 = mucho volumen. */
  volumen: number
  peana: boolean
  textoPeana?: string
  fuente?: string
}

const LADO_REJILLA = 300 // celdas en el lado largo (detalle de la forma)
const LADO_TEXTURA = 1024 // resolución de la foto en el modelo

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

// ── 1. Silueta ──────────────────────────────────────────────

/** Separa la figura del fondo. Devuelve 1 = figura, 0 = fondo. */
function calcularMascara(px: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const n = w * h
  const mascara = new Uint8Array(n)

  // a) La imagen ya trae transparencia (fondo quitado)
  let transparentes = 0
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 128) transparentes++
  if (transparentes > n * 0.03) {
    for (let i = 0; i < n; i++) mascara[i] = px[i * 4 + 3] >= 128 ? 1 : 0
    return limpiar(mascara, w, h)
  }

  // b) Fondo liso: relleno desde los bordes con colores parecidos al del borde
  const borde: number[][] = []
  for (let x = 0; x < w; x++) borde.push(color(px, x, 0, w), color(px, x, h - 1, w))
  for (let y = 0; y < h; y++) borde.push(color(px, 0, y, w), color(px, w - 1, y, w))
  const ref = [0, 1, 2].map((k) => mediana(borde.map((c) => c[k])))
  const dispersion = mediana(borde.map((c) => dist(c, ref)))
  if (dispersion > 40) return rellenarTodo(mascara) // el borde no es liso: placa rectangular

  const tolerancia = 38 + dispersion
  const fondo = new Uint8Array(n)
  const pila: number[] = []
  const empujar = (x: number, y: number) => {
    const i = y * w + x
    if (fondo[i]) return
    if (dist(color(px, x, y, w), ref) > tolerancia) return
    fondo[i] = 1
    pila.push(i)
  }
  for (let x = 0; x < w; x++) (empujar(x, 0), empujar(x, h - 1))
  for (let y = 0; y < h; y++) (empujar(0, y), empujar(w - 1, y))
  while (pila.length) {
    const i = pila.pop()!
    const x = i % w
    const y = (i / w) | 0
    if (x > 0) empujar(x - 1, y)
    if (x < w - 1) empujar(x + 1, y)
    if (y > 0) empujar(x, y - 1)
    if (y < h - 1) empujar(x, y + 1)
  }
  for (let i = 0; i < n; i++) mascara[i] = fondo[i] ? 0 : 1
  // Recorta un píxel del contorno para que no quede el halo claro del fondo.
  const limpia = limpiar(erosionar(mascara, w, h), w, h)
  const ocupado = limpia.reduce((a, b) => a + b, 0) / n
  return ocupado < 0.05 || ocupado > 0.97 ? rellenarTodo(mascara) : limpia
}

const color = (px: Uint8ClampedArray, x: number, y: number, w: number) => {
  const i = (y * w + x) * 4
  return [px[i], px[i + 1], px[i + 2]]
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1]
const rellenarTodo = (m: Uint8Array) => m.fill(1)

function erosionar(m: Uint8Array, w: number, h: number): Uint8Array {
  const r = new Uint8Array(m)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!m[i]) continue
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w]) r[i] = 0
    }
  return r
}

/** Se queda con la mancha más grande (quita motas sueltas). */
function limpiar(m: Uint8Array, w: number, h: number): Uint8Array {
  const etiqueta = new Int32Array(w * h).fill(-1)
  let mejor = -1
  let tamMejor = 0
  let actual = 0
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || etiqueta[s] >= 0) continue
    let tam = 0
    const pila = [s]
    etiqueta[s] = actual
    while (pila.length) {
      const i = pila.pop()!
      tam++
      const x = i % w
      const y = (i / w) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (m[j] && etiqueta[j] < 0) {
          etiqueta[j] = actual
          pila.push(j)
        }
      }
    }
    if (tam > tamMejor) {
      tamMejor = tam
      mejor = actual
    }
    actual++
  }
  const r = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) r[i] = etiqueta[i] === mejor ? 1 : 0
  return r
}

// ── 2. Volumen ──────────────────────────────────────────────

/** Distancia (en celdas) de cada punto de la figura al borde más cercano. */
function distanciaAlBorde(m: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? INF : 0
  const D = Math.SQRT2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!d[i]) continue
      const v = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : d[yy * w + xx])
      d[i] = Math.min(d[i], v(x - 1, y) + 1, v(x, y - 1) + 1, v(x - 1, y - 1) + D, v(x + 1, y - 1) + D)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!d[i]) continue
      const v = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : d[yy * w + xx])
      d[i] = Math.min(d[i], v(x + 1, y) + 1, v(x, y + 1) + 1, v(x + 1, y + 1) + D, v(x - 1, y + 1) + D)
    }
  return d
}

function suavizar(a: Float32Array, m: Uint8Array, w: number, h: number, veces: number): Float32Array {
  let src: Float32Array = a
  for (let k = 0; k < veces; k++) {
    const dst = new Float32Array(src)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!m[i]) continue
        let s = 0
        let c = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h || !m[yy * w + xx]) continue
            s += src[yy * w + xx]
            c++
          }
        dst[i] = s / c
      }
    src = dst
  }
  return src
}

// ── 3. Malla ────────────────────────────────────────────────

interface Piezas {
  frente: THREE.BufferGeometry
  resto: THREE.BufferGeometry
  ancho: number
  alto: number
  fondoMax: number
}

function construirMalla(m: Uint8Array, alturas: Float32Array, w: number, h: number, escala: number): Piezas {
  // Vértices en las esquinas de las celdas; altura = media de las celdas vecinas de la figura.
  const W = w + 1
  const H = h + 1
  const zEsquina = new Float32Array(W * H)
  const dentro = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0
      let c = 0
      for (const [cx, cy] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) {
        if (cx < 0 || cy < 0 || cx >= w || cy >= h || !m[cy * w + cx]) continue
        s += alturas[cy * w + cx]
        c++
      }
      if (c) {
        // En el borde exterior la pieza baja hacia el grosor mínimo.
        zEsquina[y * W + x] = c < 4 ? (s / c) * 0.55 : s / c
        dentro[y * W + x] = 1
      }
    }

  // Límites de la figura para centrarla y apoyarla en y = 0
  let minX = w, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x + 1)
        maxY = Math.max(maxY, y + 1)
      }
  const cx = (minX + maxX) / 2
  const px = (x: number) => (x - cx) * escala
  const py = (y: number) => (maxY - y) * escala

  // Frente (con la foto)
  const posF: number[] = []
  const uvF: number[] = []
  const indiceF = new Int32Array(W * H).fill(-1)
  const vF = (x: number, y: number) => {
    const k = y * W + x
    if (indiceF[k] < 0) {
      indiceF[k] = posF.length / 3
      posF.push(px(x), py(y), zEsquina[k])
      uvF.push(x / w, y / h) // glTF: origen arriba a la izquierda (flipY = false)
    }
    return indiceF[k]
  }
  const idxF: number[] = []
  // Trasera y laterales (color liso)
  const posR: number[] = []
  const quad = (a: number[], b: number[], c: number[], d: number[]) => posR.push(...a, ...b, ...c, ...a, ...c, ...d)

  let fondoMax = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue
      const a = vF(x, y), b = vF(x + 1, y), c = vF(x + 1, y + 1), d = vF(x, y + 1)
      idxF.push(a, d, c, a, c, b)
      fondoMax = Math.max(fondoMax, zEsquina[y * W + x])
      // trasera (z = 0), mirando hacia atrás
      quad([px(x), py(y), 0], [px(x + 1), py(y), 0], [px(x + 1), py(y + 1), 0], [px(x), py(y + 1), 0])
      // paredes donde la celda vecina es fondo
      const z = (xx: number, yy: number) => zEsquina[yy * W + xx]
      const fuera = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h || !m[yy * w + xx]
      if (fuera(x, y - 1)) quad([px(x), py(y), 0], [px(x), py(y), z(x, y)], [px(x + 1), py(y), z(x + 1, y)], [px(x + 1), py(y), 0])
      if (fuera(x, y + 1)) quad([px(x + 1), py(y + 1), 0], [px(x + 1), py(y + 1), z(x + 1, y + 1)], [px(x), py(y + 1), z(x, y + 1)], [px(x), py(y + 1), 0])
      if (fuera(x - 1, y)) quad([px(x), py(y + 1), 0], [px(x), py(y + 1), z(x, y + 1)], [px(x), py(y), z(x, y)], [px(x), py(y), 0])
      if (fuera(x + 1, y)) quad([px(x + 1), py(y), 0], [px(x + 1), py(y), z(x + 1, y)], [px(x + 1), py(y + 1), z(x + 1, y + 1)], [px(x + 1), py(y + 1), 0])
    }

  const frente = new THREE.BufferGeometry()
  frente.setAttribute('position', new THREE.Float32BufferAttribute(posF, 3))
  frente.setAttribute('uv', new THREE.Float32BufferAttribute(uvF, 2))
  frente.setIndex(idxF)
  frente.computeVertexNormals()
  const resto = new THREE.BufferGeometry()
  resto.setAttribute('position', new THREE.Float32BufferAttribute(posR, 3))
  resto.computeVertexNormals()
  return { frente, resto, ancho: (maxX - minX) * escala, alto: maxY * escala, fondoMax }
}

// ── 4. Peana con texto ──────────────────────────────────────

async function crearPeana(ancho: number, fondo: number, texto: string | undefined, fuenteId: string | undefined): Promise<THREE.Mesh> {
  const alto = 0.09
  const geo = new THREE.BoxGeometry(ancho, alto, fondo)
  const liso = new THREE.MeshStandardMaterial({ color: '#15182a', roughness: 0.55, metalness: 0.2 })
  const materiales: THREE.Material[] = [liso, liso, liso, liso, liso, liso]
  if (texto?.trim()) {
    const f = fuentePorId(fuenteId)
    await cargarFuente(f).catch(() => undefined)
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = Math.max(64, Math.round((1024 * alto) / ancho))
    const g = c.getContext('2d')!
    g.fillStyle = '#15182a'
    g.fillRect(0, 0, c.width, c.height)
    let tam = c.height * 0.72
    const fuenteCss = () => `${f.peso} ${tam}px "${f.familia}", sans-serif`
    g.font = fuenteCss()
    while (g.measureText(texto).width > c.width * 0.92 && tam > 8) {
      tam *= 0.92
      g.font = fuenteCss()
    }
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(texto.trim(), c.width / 2, c.height / 2 + tam * 0.04)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false
    t.userData.mimeType = 'image/png'
    // La cara frontal (+z) de BoxGeometry es la 5.ª; con flipY=false invertimos su V.
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 16; i < 20; i++) uv.setY(i, 1 - uv.getY(i))
    materiales[4] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })
  }
  const peana = new THREE.Mesh(geo, materiales)
  peana.name = 'peana'
  peana.position.y = -alto / 2
  return peana
}

// ── Punto de entrada ────────────────────────────────────────

export async function crearRelieve(imagen: Blob, op: OpcionesRelieve, alProgresar: AlProgresar): Promise<Blob> {
  const servicio = 'Retrato en relieve · en tu móvil'
  alProgresar({ etapa: 'analizando', porcentaje: 8, servicio, detalle: 'Separando la figura del fondo' })
  const bmp = await cargarBitmap(imagen)
  const proporcion = bmp.width / bmp.height
  const w = proporcion >= 1 ? LADO_REJILLA : Math.round(LADO_REJILLA * proporcion)
  const h = proporcion >= 1 ? Math.round(LADO_REJILLA / proporcion) : LADO_REJILLA

  // Rejilla reducida para la forma
  const rej = document.createElement('canvas')
  rej.width = w
  rej.height = h
  const gr = rej.getContext('2d', { willReadFrequently: true })!
  gr.drawImage(bmp, 0, 0, w, h)
  const px = gr.getImageData(0, 0, w, h).data
  const mascara = calcularMascara(px, w, h)
  await esperar(250)

  alProgresar({ etapa: 'forma', porcentaje: 35, servicio, detalle: 'Dando volumen' })
  const d = distanciaAlBorde(mascara, w, h)
  let dMax = 0
  for (let i = 0; i < d.length; i++) dMax = Math.max(dMax, d[i])
  const escala = 1 / Math.max(w, h) // la pieza mide 1 unidad en su lado largo
  const grosorBase = 0.035
  const relieve = 0.03 + 0.17 * Math.min(1, Math.max(0, op.volumen))
  let alturas: Float32Array = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (!mascara[i]) continue
    const t = Math.min(1, d[i] / (dMax || 1))
    const redondo = Math.sqrt(1 - (1 - t) * (1 - t)) // perfil de cojín: sube rápido y se aplana arriba
    const luz = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255
    alturas[i] = grosorBase + relieve * redondo + 0.012 * (luz - 0.5) * redondo
  }
  alturas = suavizar(alturas, mascara, w, h, 2)
  await esperar(250)

  const piezas = construirMalla(mascara, alturas, w, h, escala)
  alProgresar({ etapa: 'texturas', porcentaje: 70, servicio, detalle: 'Pintando la foto' })

  // Foto a buena resolución para el frente
  const lienzo = document.createElement('canvas')
  const k = Math.min(1, LADO_TEXTURA / Math.max(bmp.width, bmp.height))
  lienzo.width = Math.round(bmp.width * k)
  lienzo.height = Math.round(bmp.height * k)
  const gl = lienzo.getContext('2d')!
  gl.fillStyle = '#ffffff'
  gl.fillRect(0, 0, lienzo.width, lienzo.height)
  gl.drawImage(bmp, 0, 0, lienzo.width, lienzo.height)
  bmp.close()
  const foto = new THREE.CanvasTexture(lienzo)
  foto.colorSpace = THREE.SRGBColorSpace
  foto.flipY = false
  foto.userData.mimeType = 'image/jpeg'

  const grupo = new THREE.Group()
  grupo.name = 'retrato-en-relieve'
  grupo.add(new THREE.Mesh(piezas.frente, new THREE.MeshStandardMaterial({ map: foto, roughness: 0.6 })))
  grupo.add(new THREE.Mesh(piezas.resto, new THREE.MeshStandardMaterial({ color: '#2a2d3d', roughness: 0.7 })))
  if (op.peana) {
    const fondoPeana = Math.max(0.22, piezas.fondoMax + 0.12)
    const peana = await crearPeana(piezas.ancho * 1.08 + 0.04, fondoPeana, op.textoPeana, op.fuente)
    peana.position.z = piezas.fondoMax / 2
    grupo.add(peana)
  }
  await esperar(200)

  alProgresar({ etapa: 'texturas', porcentaje: 92, servicio, detalle: 'Guardando' })
  const glb = (await new GLTFExporter().parseAsync(grupo, { binary: true })) as ArrayBuffer
  foto.dispose()
  return new Blob([glb], { type: 'model/gltf-binary' })
}
