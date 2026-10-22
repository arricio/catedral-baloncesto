/**
 * La "impresora 3D" animada de la pantalla principal.
 * El cabezal recorre la base en zigzag y la pieza aparece capa a capa según el progreso.
 * Cuando el modelo real llega, se "imprime" de abajo arriba con un plano de corte
 * antes de mostrar el resultado final.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CONFIG_CALIDAD, nivelCalidad } from '../lib/calidad'
import { cargarGLB, normalizar } from '../lib/escena'
import { Estudio } from './Estudio'

const ALTO_PIEZA = 1.1
const CIAN = new THREE.Color('#22e3ff')
const MAGENTA = new THREE.Color('#ff3dd8')

/** Estructura de la impresora: base, columnas, puente y cama con rejilla. */
function Estructura() {
  const metal = <meshStandardMaterial color="#1b1e2e" metalness={0.8} roughness={0.35} />
  return (
    <group>
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[2.3, 0.12, 2.0]} />
        {metal}
      </mesh>
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 1.0, -0.85]}>
          <boxGeometry args={[0.09, 2.1, 0.09]} />
          {metal}
        </mesh>
      ))}
      <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.8, 1.6]} />
        <meshStandardMaterial color="#0d1020" metalness={0.3} roughness={0.6} />
      </mesh>
      <gridHelper args={[1.6, 16, '#22e3ff', '#26304d']} position={[0, 0.012, 0]} />
    </group>
  )
}

/** Pieza provisional mientras la IA trabaja: un jarrón de capas de neón. */
function PiezaProvisional({ progreso }: { progreso: number }) {
  const capas = 40
  const geos = useMemo(
    () =>
      Array.from({ length: capas }, (_, i) => {
        const t = i / capas
        const r = 0.32 + 0.16 * Math.sin(t * Math.PI * 1.6 + 0.4) + 0.05 * Math.sin(t * 18)
        return { r, color: CIAN.clone().lerp(MAGENTA, t) }
      }),
    [],
  )
  const visibles = Math.floor(progreso * capas)
  const h = ALTO_PIEZA / capas
  return (
    <group>
      {geos.slice(0, visibles).map((g, i) => (
        <mesh key={i} position={[0, h * i + h / 2, 0]}>
          <cylinderGeometry args={[g.r, g.r, h * 0.82, 40, 1]} />
          <meshStandardMaterial color={g.color} emissive={g.color} emissiveIntensity={i === visibles - 1 ? 1.4 : 0.25} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

/** Modelo real, revelado de abajo arriba con un plano de corte. */
function PiezaReal({ glb, altura, alCargar }: { glb: Blob; altura: React.RefObject<number>; alCargar: (alto: number) => void }) {
  const [obj, setObj] = useState<THREE.Group | null>(null)
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), [])
  useEffect(() => {
    let vivo = true
    cargarGLB(glb).then((g) => {
      if (!vivo) return
      const caja = normalizar(g, 1.25)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.material = [m.material].flat().map((mat) => {
            const c = mat.clone()
            c.clippingPlanes = [plano]
            c.clipShadows = true
            return c
          }) as unknown as THREE.Material
          if (Array.isArray(m.material) && m.material.length === 1) m.material = m.material[0]
        }
      })
      setObj(g)
      alCargar(caja.max.y)
    })
    return () => {
      vivo = false
    }
  }, [glb, plano, alCargar])
  useFrame(() => {
    plano.constant = altura.current ?? 0
  })
  return obj ? <primitive object={obj} /> : null
}

function Cabezal({ altura, activo }: { altura: React.RefObject<number>; activo: boolean }) {
  const grupo = useRef<THREE.Group>(null)
  const puente = useRef<THREE.Mesh>(null)
  const luz = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const y = (altura.current ?? 0) + 0.12
    // Zigzag: barrido rápido en X, avance lento en Z.
    const x = activo ? Math.sin(t * 3.2) * 0.42 : 0
    const z = activo ? Math.sin(t * 0.7) * 0.36 : 0
    grupo.current?.position.set(x, y, z)
    puente.current?.position.set(0, y + 0.13, -0.42)
    if (luz.current) luz.current.intensity = activo ? 1.4 + Math.sin(t * 20) * 0.4 : 0.4
  })
  return (
    <>
      <mesh ref={puente}>
        <boxGeometry args={[2.18, 0.07, 0.07]} />
        <meshStandardMaterial color="#2a2f48" metalness={0.8} roughness={0.3} />
      </mesh>
      <group ref={grupo}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.24, 0.16, 0.2]} />
          <meshStandardMaterial color="#e9ecff" metalness={0.5} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <coneGeometry args={[0.04, 0.08, 16]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff7a00" emissiveIntensity={activo ? 2 : 0.2} />
        </mesh>
        <pointLight ref={luz} position={[0, -0.03, 0]} color="#ff3dd8" distance={0.9} />
      </group>
    </>
  )
}

function Escena({ progreso, glbFinal, alTerminar }: { progreso: number; glbFinal?: Blob; alTerminar?: () => void }) {
  const altura = useRef(0)
  const [altoReal, setAltoReal] = useState<number | null>(null)
  const [activo, setActivo] = useState(true)
  const inicio = useRef<number | null>(null)
  const grupo = useRef<THREE.Group>(null)
  const avisado = useRef(false)
  const { invalidate } = useThree()

  useFrame((_, dt) => {
    // Con el modelo real: se "imprime" en 2,8 s (por reloj real, aunque el móvil vaya a pocos FPS).
    let objetivo = progreso * ALTO_PIEZA
    if (altoReal != null) {
      inicio.current ??= performance.now()
      const r = Math.min(1, (performance.now() - inicio.current) / 2800)
      objetivo = r * (altoReal + 0.02)
      if (r >= 1 && !avisado.current) {
        avisado.current = true
        altura.current = objetivo
        setActivo(false)
        alTerminar?.()
      }
      if (r >= 1 && grupo.current) grupo.current.rotation.y += dt * 0.5
    }
    // Avance suave del cabezal hacia la altura objetivo.
    if (!avisado.current) altura.current += (objetivo - altura.current) * Math.min(1, dt * 4)
    invalidate()
  })
  return (
    <>
      <Estructura />
      <group ref={grupo}>
        {glbFinal ? <PiezaReal glb={glbFinal} altura={altura} alCargar={setAltoReal} /> : <PiezaProvisional progreso={progreso} />}
      </group>
      <Cabezal altura={altura} activo={activo} />
    </>
  )
}

export function ImpresoraAnimada({ progreso, glbFinal, alTerminar, className = '' }: { progreso: number; glbFinal?: Blob; alTerminar?: () => void; className?: string }) {
  const nivel = useMemo(nivelCalidad, [])
  const cfg = CONFIG_CALIDAD[nivel]
  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`} style={{ background: 'radial-gradient(120% 90% at 50% 0%, #1d0c3a 0%, #0a1430 50%, #03040a 100%)' }}>
      <Canvas
        dpr={cfg.dpr}
        camera={{ position: [2.4, 1.9, 2.9], fov: 32 }}
        gl={{ antialias: cfg.antialias, alpha: true, localClippingEnabled: true } as never}
        onCreated={({ gl, camera }) => {
          gl.localClippingEnabled = true
          gl.toneMapping = THREE.ACESFilmicToneMapping
          camera.lookAt(0, 0.6, 0)
        }}
        aria-hidden
      >
        <Suspense fallback={null}>
          <Estudio nivel={nivel} suelo={false} />
          <Escena progreso={Math.max(0.04, Math.min(1, progreso))} glbFinal={glbFinal} alTerminar={alTerminar} />
        </Suspense>
      </Canvas>
    </div>
  )
}
