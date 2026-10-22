/**
 * Medios para redes sociales, generados en el navegador:
 *  - Captura PNG en alta resolución con fondo personalizable.
 *  - Vídeo corto del modelo girando (MP4 con WebCodecs; si no hay soporte, WebM).
 *  Formatos: 1:1 (Instagram), 9:16 (TikTok, Reels, Estados de WhatsApp), 16:9 (YouTube).
 */
import * as THREE from 'three'
import { create } from 'zustand'

export type Proporcion = '1:1' | '9:16' | '16:9'
export type FondoCaptura = 'oscuro' | 'claro' | 'degradado' | 'transparente' | `#${string}`

/** Acceso a la escena del visor (lo registra el componente Visor3D). */
export interface EscenaVisor {
  gl: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Objeto que gira en el vídeo. */
  modelo: THREE.Object3D
  /** Punto al que mira la cámara (centro del modelo). */
  objetivo: THREE.Vector3
  /** Pausa/reanuda el bucle de render del visor. */
  pausar: (si: boolean) => void
}

export const useEscenaVisor = create<{ escena: EscenaVisor | null }>(() => ({ escena: null }))

export function dimensiones(p: Proporcion, ladoCorto: number): [number, number] {
  if (p === '1:1') return [ladoCorto, ladoCorto]
  if (p === '9:16') return [ladoCorto, Math.round((ladoCorto * 16) / 9 / 2) * 2]
  return [Math.round((ladoCorto * 16) / 9 / 2) * 2, ladoCorto]
}

function texturaDegradado(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 512
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#2a0b4d')
  g.addColorStop(0.55, '#0b1a3d')
  g.addColorStop(1, '#03040a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function fondoEscena(fondo: FondoCaptura): THREE.Color | THREE.Texture | null {
  if (fondo === 'transparente') return null
  if (fondo === 'oscuro') return new THREE.Color('#07080f')
  if (fondo === 'claro') return new THREE.Color('#f2f4f8')
  if (fondo === 'degradado') return texturaDegradado()
  return new THREE.Color(fondo)
}

/**
 * Prepara el renderizador del visor para producir imágenes de `ancho×alto`
 * y devuelve funciones para renderizar un fotograma y restaurar todo.
 */
function prepararRender(esc: EscenaVisor, ancho: number, alto: number, fondo: FondoCaptura) {
  const { gl, scene, camera } = esc
  esc.pausar(true)
  const tamOriginal = gl.getSize(new THREE.Vector2())
  const prOriginal = gl.getPixelRatio()
  const fondoOriginal = scene.background
  const colorLimpio = gl.getClearColor(new THREE.Color())
  const alfaLimpio = gl.getClearAlpha()
  const cam = camera.clone()
  cam.aspect = ancho / alto
  // En vertical alejamos un poco la cámara para que el modelo quepa a lo ancho.
  if (cam.aspect < 1) {
    const dir = cam.position.clone().sub(esc.objetivo).multiplyScalar(1 / Math.max(cam.aspect, 0.6))
    cam.position.copy(esc.objetivo).add(dir)
  }
  cam.updateProjectionMatrix()
  const bg = fondoEscena(fondo)
  scene.background = bg
  if (!bg) gl.setClearColor(0x000000, 0)
  gl.setPixelRatio(1)
  gl.setSize(ancho, alto, false)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')!

  return {
    cam,
    lienzo,
    /** Renderiza y copia el fotograma al lienzo 2D (inmediatamente, antes de que se borre). */
    fotograma() {
      gl.render(scene, cam)
      ctx.clearRect(0, 0, ancho, alto)
      ctx.drawImage(gl.domElement, 0, 0, ancho, alto)
      return lienzo
    },
    restaurar() {
      if (bg instanceof THREE.Texture) bg.dispose()
      scene.background = fondoOriginal
      gl.setClearColor(colorLimpio, alfaLimpio)
      gl.setPixelRatio(prOriginal)
      gl.setSize(tamOriginal.x, tamOriginal.y, false)
      esc.pausar(false)
    },
  }
}

export async function capturarPNG(esc: EscenaVisor, proporcion: Proporcion, fondo: FondoCaptura, ladoCorto = 2048): Promise<Blob> {
  const maxTex = esc.gl.capabilities.maxTextureSize
  const [w, h] = dimensiones(proporcion, Math.min(ladoCorto, Math.floor((maxTex * 9) / 16)))
  const r = prepararRender(esc, w, h, fondo)
  try {
    const lienzo = r.fotograma()
    return await new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('Sin imagen'))), 'image/png'))
  } finally {
    r.restaurar()
  }
}

// ── Vídeo ───────────────────────────────────────────────────

export interface OpcionesVideo {
  proporcion: Proporcion
  fondo: FondoCaptura
  segundos?: number
  fps?: number
  ladoCorto?: number
  alProgresar?: (p: number) => void
}

async function codecMP4(w: number, h: number): Promise<string | null> {
  if (!('VideoEncoder' in window)) return null
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
    try {
      const s = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 6_000_000, framerate: 30 })
      if (s.supported) return codec
    } catch {
      /* siguiente */
    }
  }
  return null
}

export async function grabarVideo(esc: EscenaVisor, op: OpcionesVideo): Promise<Blob> {
  const fps = op.fps ?? 30
  const segundos = op.segundos ?? 6
  const total = fps * segundos
  // El fondo transparente no existe en MP4: se usa el degradado.
  const fondo = op.fondo === 'transparente' ? 'degradado' : op.fondo
  const [w, h] = dimensiones(op.proporcion, op.ladoCorto ?? 1080)
  const codec = await codecMP4(w, h)
  const r = prepararRender(esc, w, h, fondo)
  const giroInicial = esc.modelo.rotation.y
  const girar = (i: number) => {
    esc.modelo.rotation.y = giroInicial + (i / total) * Math.PI * 2
  }
  try {
    if (codec) return await grabarMP4(r, codec, w, h, fps, total, girar, op.alProgresar)
    return await grabarWebM(r, fps, total, girar, op.alProgresar)
  } finally {
    esc.modelo.rotation.y = giroInicial
    r.restaurar()
  }
}

type Render = ReturnType<typeof prepararRender>

async function grabarMP4(r: Render, codec: string, w: number, h: number, fps: number, total: number, girar: (i: number) => void, alProgresar?: (p: number) => void): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' })
  let error: unknown = null
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (error = e) })
  encoder.configure({ codec, width: w, height: h, bitrate: Math.round(w * h * fps * 0.12), framerate: fps })
  for (let i = 0; i < total; i++) {
    if (error) throw error
    girar(i)
    const frame = new VideoFrame(r.fotograma(), { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    // No saturar la cola del codificador (importante en móviles).
    while (encoder.encodeQueueSize > 4) await new Promise((ok) => setTimeout(ok, 5))
    if (i % 5 === 0) {
      alProgresar?.(i / total)
      await new Promise((ok) => setTimeout(ok, 0))
    }
  }
  await encoder.flush()
  encoder.close()
  muxer.finalize()
  alProgresar?.(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

/** Alternativa sin WebCodecs: graba el lienzo en tiempo real con MediaRecorder. */
async function grabarWebM(r: Render, fps: number, total: number, girar: (i: number) => void, alProgresar?: (p: number) => void): Promise<Blob> {
  const flujo = r.lienzo.captureStream(fps)
  const tipo = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  const grabadora = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 6_000_000 })
  const trozos: Blob[] = []
  grabadora.ondataavailable = (e) => e.data.size && trozos.push(e.data)
  const fin = new Promise<void>((ok) => (grabadora.onstop = () => ok()))
  r.fotograma()
  grabadora.start()
  for (let i = 0; i < total; i++) {
    girar(i)
    r.fotograma()
    alProgresar?.(i / total)
    await new Promise((ok) => setTimeout(ok, 1000 / fps))
  }
  grabadora.stop()
  await fin
  return new Blob(trozos, { type: tipo.split(';')[0] || 'video/webm' })
}
