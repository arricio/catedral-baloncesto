/**
 * Utilidades three.js compartidas: cargar un GLB, centrarlo y renderizar
 * fuera de pantalla (miniaturas). Se importan bajo demanda para no frenar el arranque.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export async function cargarGLB(glb: Blob): Promise<THREE.Group> {
  const datos = await glb.arrayBuffer()
  const gltf = await new GLTFLoader().parseAsync(datos, '')
  return gltf.scene
}

/**
 * Centra el modelo en el origen, lo apoya en el suelo (y=0) y lo escala
 * para que su lado mayor mida `tamaño` unidades.
 */
export function normalizar(obj: THREE.Object3D, tamaño = 1): THREE.Box3 {
  obj.updateMatrixWorld(true)
  const caja = new THREE.Box3().setFromObject(obj)
  const dim = caja.getSize(new THREE.Vector3())
  const escala = tamaño / Math.max(dim.x, dim.y, dim.z, 1e-6)
  obj.scale.multiplyScalar(escala)
  obj.updateMatrixWorld(true)
  caja.setFromObject(obj)
  const centro = caja.getCenter(new THREE.Vector3())
  obj.position.x -= centro.x
  obj.position.z -= centro.z
  obj.position.y -= caja.min.y
  obj.updateMatrixWorld(true)
  return caja.setFromObject(obj)
}

/** Renderiza el GLB a un PNG/WebP cuadrado (miniatura de la biblioteca). */
export async function renderizarMiniatura(glb: Blob, lado = 384): Promise<HTMLCanvasElement> {
  const modelo = await cargarGLB(glb)
  normalizar(modelo, 1)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = lado
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(lado, lado, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const escena = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  escena.add(modelo)
  const camara = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
  const caja = new THREE.Box3().setFromObject(modelo)
  const centro = caja.getCenter(new THREE.Vector3())
  const radio = caja.getBoundingSphere(new THREE.Sphere()).radius
  const dist = radio / Math.sin(THREE.MathUtils.degToRad(35 / 2)) * 1.05
  camara.position.set(centro.x + dist * 0.55, centro.y + dist * 0.35, centro.z + dist * 0.78)
  camara.lookAt(centro)
  renderer.render(escena, camara)
  // Copiamos a un lienzo 2D y liberamos el contexto WebGL (los móviles tienen pocos).
  const copia = document.createElement('canvas')
  copia.width = copia.height = lado
  copia.getContext('2d')!.drawImage(canvas, 0, 0)
  pmrem.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  return copia
}
