/**
 * Sonido de impresora 3D generado al momento con Web Audio (sin archivos, funciona sin conexión):
 *  - zumbido de los motores paso a paso, que cambia de tono con cada movimiento del cabezal;
 *  - el ventilador de fondo;
 *  - un «clac» suave al cambiar de capa;
 *  - un «ding» al terminar.
 * Los móviles solo dejan sonar audio después de un toque: por eso se llama a
 * desbloquearSonido() desde los botones «Imprimir».
 */
import { ajustes } from './ajustes'

let ctx: AudioContext | null = null
let activo: { parar: () => void } | null = null

function contexto(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    return ctx
  } catch {
    return null
  }
}

/** Llamar desde un toque del usuario (requisito de Android/iPhone). */
export function desbloquearSonido() {
  const c = contexto()
  if (c?.state === 'suspended') c.resume().catch(() => undefined)
}

function ruido(c: AudioContext, segundos = 2): AudioBuffer {
  const b = c.createBuffer(1, c.sampleRate * segundos, c.sampleRate)
  const d = b.getChannelData(0)
  let ultimo = 0
  for (let i = 0; i < d.length; i++) {
    // Ruido «marrón»: más grave y agradable que el blanco.
    ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = ultimo * 3.5
  }
  return b
}

export function sonidoImpresoraActivo() {
  return activo !== null
}

export function iniciarSonidoImpresora() {
  if (activo || !ajustes().sonido) return
  const c = contexto()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => undefined)

  const salida = c.createGain()
  salida.gain.value = 0
  salida.gain.setTargetAtTime(0.9, c.currentTime, 0.4)
  salida.connect(c.destination)

  // Ventilador
  const vent = c.createBufferSource()
  vent.buffer = ruido(c)
  vent.loop = true
  const filtroVent = c.createBiquadFilter()
  filtroVent.type = 'lowpass'
  filtroVent.frequency.value = 420
  const gVent = c.createGain()
  gVent.gain.value = 0.05
  vent.connect(filtroVent).connect(gVent).connect(salida)
  vent.start()

  // Motores paso a paso: dos osciladores cuadrados filtrados
  const filtroMotor = c.createBiquadFilter()
  filtroMotor.type = 'bandpass'
  filtroMotor.frequency.value = 1100
  filtroMotor.Q.value = 1.4
  const gMotor = c.createGain()
  gMotor.gain.value = 0
  filtroMotor.connect(gMotor).connect(salida)
  const oscs = [c.createOscillator(), c.createOscillator()]
  oscs.forEach((o, i) => {
    o.type = 'square'
    o.frequency.value = 300 + i * 3
    o.connect(filtroMotor)
    o.start()
  })

  const NOTAS = [196, 247, 294, 330, 392, 440, 494, 587, 659]
  let temporizador = 0
  let pasos = 0
  const mover = () => {
    const t = c.currentTime
    pasos++
    if (pasos % 14 === 0) {
      // Cambio de capa: pausa breve y «clac»
      gMotor.gain.setTargetAtTime(0, t, 0.02)
      const clac = c.createBufferSource()
      clac.buffer = ruido(c, 0.05)
      const fc = c.createBiquadFilter()
      fc.type = 'highpass'
      fc.frequency.value = 1800
      const gc = c.createGain()
      gc.gain.setValueAtTime(0.5, t + 0.12)
      gc.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      clac.connect(fc).connect(gc).connect(salida)
      clac.start(t + 0.12)
      temporizador = window.setTimeout(mover, 380)
      return
    }
    const f = NOTAS[Math.floor(Math.random() * NOTAS.length)]
    oscs[0].frequency.setTargetAtTime(f, t, 0.03)
    oscs[1].frequency.setTargetAtTime(f * 1.005, t, 0.03)
    gMotor.gain.setTargetAtTime(0.045, t, 0.03)
    temporizador = window.setTimeout(mover, 140 + Math.random() * 320)
  }
  mover()

  // Sin sonido con la pantalla bloqueada o la app en segundo plano.
  const visibilidad = () => (document.hidden ? c.suspend() : c.resume()).catch(() => undefined)
  document.addEventListener('visibilitychange', visibilidad)

  activo = {
    parar() {
      clearTimeout(temporizador)
      document.removeEventListener('visibilitychange', visibilidad)
      const t = c.currentTime
      salida.gain.setTargetAtTime(0, t, 0.15)
      setTimeout(() => {
        oscs.forEach((o) => o.stop())
        vent.stop()
        salida.disconnect()
      }, 800)
    },
  }
}

export function pararSonidoImpresora() {
  activo?.parar()
  activo = null
}

/** «Ding» de trabajo terminado. */
export function sonidoListo() {
  if (!ajustes().sonido) return
  const c = contexto()
  if (!c) return
  const t = c.currentTime
  ;[
    [880, 0],
    [1318.5, 0.16],
  ].forEach(([f, retraso]) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + retraso)
    g.gain.exponentialRampToValueAtTime(0.25, t + retraso + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + retraso + 0.9)
    o.connect(g).connect(c.destination)
    o.start(t + retraso)
    o.stop(t + retraso + 1)
  })
}
