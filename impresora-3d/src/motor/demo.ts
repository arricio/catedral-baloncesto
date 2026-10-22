/**
 * Motor de DEMOSTRACIÓN (solo para pruebas automáticas y sin conexión).
 * Se activa abriendo la app con ?demo=1. No usa IA: crea una figura de colores
 * a partir de la imagen, para poder probar toda la interfaz sin gastar cupo.
 */
import { ErrorMotor, MENSAJES, type Motor, type AlProgresar } from './tipos'

const esperar = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((ok, mal) => {
    const t = setTimeout(ok, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), mal(new DOMException('cancelado', 'AbortError'))), { once: true })
  })

async function simular(alProgresar: AlProgresar, etapas: ['analizando' | 'forma' | 'texturas' | 'imagen', number][], signal?: AbortSignal) {
  alProgresar({ etapa: 'cola', porcentaje: 2, posicionCola: 2, eta: 3, servicio: 'Demostración' })
  await esperar(400, signal)
  for (const [etapa, hasta] of etapas) {
    for (let p = 0; p <= 4; p++) {
      alProgresar({ etapa, porcentaje: hasta - 20 + p * 5, servicio: 'Demostración' })
      await esperar(120, signal)
    }
  }
}

export const motorDemo: Motor = {
  id: 'demo',
  nombre: 'Demostración',
  async textoAImagen(prompt, alProgresar, signal) {
    // Para probar la pantalla de cupo agotado: escribir «#cupo» en la descripción.
    if (prompt.includes('#cupo')) throw new ErrorMotor('cupo', MENSAJES.cupo, 'FLUX.1 schnell: You have exceeded your free GPU quota (demostración)')
    await simular(alProgresar, [['imagen', 95]], signal)
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    const g = ctx.createRadialGradient(220, 200, 20, 256, 256, 200)
    g.addColorStop(0, '#ff5a5a')
    g.addColorStop(1, '#b0102a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(256, 256, 170, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(prompt.slice(0, 24), 256, 490)
    const imagen = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/png'))
    return { imagen, servicio: 'Demostración' }
  },
  async imagenA3D(imagen, opciones, alProgresar) {
    await simular(alProgresar, [['analizando', 25], ['forma', 65], ['texturas', 95]], opciones.signal)
    const THREE = await import('three')
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
    const bmp = await createImageBitmap(imagen)
    const c = document.createElement('canvas')
    c.width = c.height = 512
    c.getContext('2d')!.drawImage(bmp, 0, 0, 512, 512)
    const textura = new THREE.CanvasTexture(c)
    textura.colorSpace = THREE.SRGBColorSpace
    textura.flipY = false
    const grupo = new THREE.Group()
    const cuerpo = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 48, 32),
      new THREE.MeshStandardMaterial({ map: textura, roughness: 0.5 }),
    )
    cuerpo.scale.set(1, 1.15, 1)
    cuerpo.position.y = 0.65
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.15, 48),
      new THREE.MeshStandardMaterial({ color: '#1fd6ff', roughness: 0.4 }),
    )
    base.position.y = 0.075
    grupo.add(cuerpo, base)
    const glb = await new GLTFExporter().parseAsync(grupo, { binary: true })
    return { glb: new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' }), servicio: 'Demostración' }
  },
}
