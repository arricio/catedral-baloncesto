/**
 * Calidad gráfica automática según la potencia del dispositivo.
 * Ahorra batería en móviles modestos y aprovecha los potentes.
 */
import { ajustes } from './ajustes'
import { esMovil } from './plataforma'

export type Nivel = 'baja' | 'media' | 'alta'

let detectado: Nivel | null = null

function detectar(): Nivel {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const memoria = nav.deviceMemory ?? 4
  const nucleos = nav.hardwareConcurrency ?? 4
  let gpu = ''
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    gpu = (ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '').toLowerCase()
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    /* sin información */
  }
  const gpuFlojita = /mali-(4|t6|t7|g3|g5[12])|adreno \(tm\) (3|4|50)|powervr|sgx|swiftshader|llvmpipe/.test(gpu)
  if (gpuFlojita || memoria <= 2 || nucleos <= 4) return 'baja'
  if (esMovil && (memoria <= 4 || nucleos <= 6)) return 'media'
  return esMovil ? 'media' : 'alta'
}

export function nivelCalidad(): Nivel {
  const elegido = ajustes().calidad
  if (elegido !== 'auto') return elegido
  detectado ??= detectar()
  return detectado
}

export const CONFIG_CALIDAD: Record<Nivel, { dpr: [number, number]; antialias: boolean; reflejos: boolean; sombras: number }> = {
  baja: { dpr: [1, 1], antialias: false, reflejos: false, sombras: 256 },
  media: { dpr: [1, 1.5], antialias: true, reflejos: false, sombras: 512 },
  alta: { dpr: [1, 2], antialias: true, reflejos: true, sombras: 1024 },
}
