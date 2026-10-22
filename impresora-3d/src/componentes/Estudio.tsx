/**
 * Iluminación de estudio (HDRI generado al vuelo con "lightformers": no descarga nada,
 * funciona sin conexión), sombras suaves de contacto y suelo reflectante opcional.
 */
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import type { Nivel } from '../lib/calidad'
import { CONFIG_CALIDAD } from '../lib/calidad'

export function Estudio({ nivel, suelo = true, claro = false }: { nivel: Nivel; suelo?: boolean; claro?: boolean }) {
  const cfg = CONFIG_CALIDAD[nivel]
  return (
    <>
      <Environment resolution={nivel === 'baja' ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[5, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="ring" color="#22e3ff" intensity={1.2} position={[-3, 3, 4]} scale={2} />
        <Lightformer form="ring" color="#ff3dd8" intensity={1.2} position={[3, 3, 4]} scale={2} />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 2]} intensity={0.8} />
      {suelo && (
        <>
          <ContactShadows position={[0, 0.001, 0]} opacity={claro ? 0.4 : 0.65} scale={6} blur={2.4} far={2.5} resolution={cfg.sombras} frames={1} />
          {cfg.reflejos && (
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
              <circleGeometry args={[3.2, 64]} />
              <MeshReflectorMaterial
                resolution={512}
                mirror={0.35}
                blur={[300, 80]}
                mixBlur={1}
                mixStrength={2.2}
                depthScale={0.8}
                minDepthThreshold={0.6}
                color={claro ? '#dfe3ee' : '#0b0d18'}
                metalness={0.4}
                roughness={0.9}
                transparent
                opacity={0.9}
              />
            </mesh>
          )}
        </>
      )}
    </>
  )
}
