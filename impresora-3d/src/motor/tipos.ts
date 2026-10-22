/**
 * Contrato común del "motor 3D". La nube (Hugging Face) y el servidor local
 * implementan la misma interfaz, así la interfaz de usuario no sabe cuál usa.
 */

export type Etapa = 'conectando' | 'cola' | 'imagen' | 'analizando' | 'forma' | 'texturas' | 'listo'

export interface Progreso {
  etapa: Etapa
  /** 0–100 (aproximado). */
  porcentaje: number
  posicionCola?: number
  /** Segundos estimados restantes. */
  eta?: number
  /** Servicio en uso, p. ej. "TRELLIS.2". */
  servicio?: string
  detalle?: string
}

export type AlProgresar = (p: Progreso) => void

export interface OpcionesImagen3D {
  /** El servicio quita el fondo (si la imagen no trae transparencia). */
  quitarFondo: boolean
  detalle: 'rapido' | 'detallado'
  signal?: AbortSignal
  /** Se llama en cuanto el servidor asigna un ID (para retomar el trabajo). */
  alCrearTrabajo?: (idRemoto: string) => void
}

export interface ResultadoModelo {
  glb: Blob
  servicio: string
}

export interface Motor {
  id: 'nube' | 'local' | 'demo'
  nombre: string
  textoAImagen(prompt: string, alProgresar: AlProgresar, signal?: AbortSignal): Promise<{ imagen: Blob; servicio: string }>
  imagenA3D(imagen: Blob, opciones: OpcionesImagen3D, alProgresar: AlProgresar): Promise<ResultadoModelo>
}

export type TipoError = 'cupo' | 'saturado' | 'red' | 'clave' | 'entrada' | 'cancelado' | 'desconocido'

/** Error con mensaje amable en español para mostrar al usuario. */
export class ErrorMotor extends Error {
  tipo: TipoError
  /** Mensaje técnico original (se muestra en pequeño para poder diagnosticar). */
  detalle?: string
  constructor(tipo: TipoError, mensaje: string, detalle?: string) {
    super(mensaje)
    this.tipo = tipo
    this.detalle = detalle
  }
}

export const MENSAJES: Record<TipoError, string> = {
  cupo:
    'Has gastado el cupo gratuito de GPU de hoy en Hugging Face. 😊 Vuelve en unas horas, inicia sesión con tu cuenta gratuita (da más cupo) o usa tu servidor local.',
  saturado: 'Los servidores gratuitos están muy llenos ahora mismo. Espera un minuto y pulsa «Reintentar».',
  red: 'Parece que no hay conexión. Comprueba el wifi o los datos y pulsa «Reintentar».',
  clave: 'La contraseña del servidor local no es correcta. Revísala en Ajustes.',
  entrada: 'No hemos podido usar esa imagen. Prueba con una foto más nítida y con el objeto centrado.',
  cancelado: 'Has cancelado la impresión.',
  desconocido: 'Algo ha fallado al crear el modelo. No es culpa tuya: pulsa «Reintentar».',
}

/** Convierte cualquier error en un ErrorMotor con mensaje amable. */
export function normalizarError(e: unknown): ErrorMotor {
  if (e instanceof ErrorMotor) return e
  const original = String((e as { message?: string })?.message ?? e ?? '')
  const texto = original.toLowerCase()
  const crear = (tipo: TipoError) => new ErrorMotor(tipo, MENSAJES[tipo], original.slice(0, 300))
  if ((e as { name?: string })?.name === 'AbortError') return crear('cancelado')
  if (/quota|cuota|cupo|exceeded|run out|zerogpu.*limit|gpu time/.test(texto)) return crear('cupo')
  if (/queue.*full|too many|429|busy|no gpu|aborted|timeout|sleeping|paused|building|503|502/.test(texto)) return crear('saturado')
  if (/failed to fetch|network|networkerror|offline|load failed/.test(texto)) return crear('red')
  if (/401|unauthori[sz]ed|contraseña/.test(texto)) return crear('clave')
  return crear('desconocido')
}
