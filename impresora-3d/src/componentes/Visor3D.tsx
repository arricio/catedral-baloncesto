/**
 * Visor 3D (three.js + @react-three/fiber + drei).
 * - Ratón: arrastrar para girar, rueda para zoom, botón derecho para mover.
 * - Táctil: un dedo gira; dos dedos hacen zoom y mueven.
 * - Ahorro de batería: solo se redibuja cuando algo cambia (salvo con el giro automático).
 */
import { Canvas, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { FondoVisor } from '../lib/ajustes'
import { CONFIG_CALIDAD, nivelCalidad } from '../lib/calidad'
import { cargarGLB, normalizar } from '../lib/escena'
import { useEscenaVisor } from '../exportar/medios'
import { Estudio } from './Estudio'

const DAMERO = '#232637'
export const FONDOS_CSS: Record<FondoVisor, CSSProperties> = {
  oscuro: { background: '#07080f' },
  claro: { background: '#eef1f7' },
  degradado: { background: 'radial-gradient(120% 90% at 50% 0%, #2a0b4d 0%, #0b1a3d 45%, #03040a 100%)' },
  transparente: {
    backgroundColor: '#1a1c28',
    backgroundImage: `linear-gradient(45deg,${DAMERO} 25%,transparent 25%),linear-gradient(-45deg,${DAMERO} 25%,transparent 25%),linear-gradient(45deg,transparent 75%,${DAMERO} 75%),linear-gradient(-45deg,transparent 75%,${DAMERO} 75%)`,
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0,0 12px,12px -12px,-12px 0',
  },
}

function Modelo({ glb, registrar }: { glb: Blob; registrar: boolean }) {
  const [obj, setObj] = useState<THREE.Group | null>(null)
  const { gl, scene, camera, setFrameloop, frameloop, invalidate } = useThree()

  useEffect(() => {
    let vivo = true
    cargarGLB(glb).then((g) => {
      if (!vivo) return
      normalizar(g, 1.6)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) m.castShadow = true
      })
      setObj(g)
      invalidate()
    })
    return () => {
      vivo = false
    }
  }, [glb, invalidate])

  // Libera la memoria de la GPU al cambiar de modelo.
  useEffect(
    () => () => {
      obj?.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of [m.material].flat()) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
          mat.dispose()
        }
      })
    },
    [obj],
  )

  // Da acceso a la escena para capturas PNG y vídeos.
  useEffect(() => {
    if (!registrar || !obj) return
    const anterior = frameloop
    useEscenaVisor.setState({
      escena: {
        gl,
        scene,
        camera: camera as THREE.PerspectiveCamera,
        modelo: obj,
        objetivo: new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()),
        pausar: (si) => {
          setFrameloop(si ? 'never' : anterior)
          if (!si) invalidate()
        },
      },
    })
    return () => useEscenaVisor.setState({ escena: null })
  }, [registrar, obj, gl, scene, camera, setFrameloop, frameloop, invalidate])

  if (!obj) return null
  return (
    <Bounds fit clip observe margin={1.25}>
      <primitive object={obj} />
    </Bounds>
  )
}

export function Visor3D({
  glb,
  fondo,
  giroAuto,
  registrar = false,
  className = '',
}: {
  glb: Blob
  fondo: FondoVisor
  giroAuto: boolean
  registrar?: boolean
  className?: string
}) {
  const nivelInicial = useMemo(nivelCalidad, [])
  const [nivel, setNivel] = useState(nivelInicial)
  const cfg = CONFIG_CALIDAD[nivel]
  const [dpr, setDpr] = useState(cfg.dpr[1])

  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`} style={FONDOS_CSS[fondo]}>
      <Canvas
        key={nivel}
        dpr={dpr}
        frameloop={giroAuto ? 'always' : 'demand'}
        camera={{ position: [2.2, 1.6, 2.8], fov: 35, near: 0.05, far: 100 }}
        gl={{ antialias: cfg.antialias, alpha: true, powerPreference: nivel === 'baja' ? 'low-power' : 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.setClearColor(0x000000, 0)
        }}
        aria-label="Visor del modelo 3D. Arrastra para girar, pellizca para hacer zoom."
        role="img"
      >
        {/* Si el móvil va justo, bajamos la resolución y después la calidad. */}
        <PerformanceMonitor
          onDecline={() => {
            if (dpr > 1) setDpr(1)
            else if (nivel !== 'baja') setNivel(nivel === 'alta' ? 'media' : 'baja')
          }}
        />
        <Suspense fallback={null}>
          <Estudio nivel={nivel} claro={fondo === 'claro'} />
          <Modelo glb={glb} registrar={registrar} />
        </Suspense>
        <OrbitControls makeDefault enableDamping autoRotate={giroAuto} autoRotateSpeed={1.6} minDistance={0.6} maxDistance={12} maxPolarAngle={Math.PI * 0.62} target={[0, 0.7, 0]} />
      </Canvas>
    </div>
  )
}
