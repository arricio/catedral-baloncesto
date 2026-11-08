// Exportación a GLB, STL (para imprimir) y OBJ.
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function nombreArchivo(nombre) {
  const limpio = (nombre || 'modelo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return limpio || 'modelo';
}

/** Envuelve el objeto para que su altura (eje Y) mida `alturaMm` y, si se pide, con Z hacia arriba. */
function preparar(objeto, alturaMm, zArriba) {
  const grupo = new THREE.Group();
  objeto.removeFromParent();
  objeto.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(objeto);
  const tam = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  const k = alturaMm / Math.max(tam.y, 1e-6);
  const interior = new THREE.Group();
  interior.add(objeto);
  // Centra en X/Z y apoya la base en el plano 0.
  interior.position.set(-centro.x, -caja.min.y, -centro.z);
  grupo.add(interior);
  grupo.scale.setScalar(k);
  if (zArriba) grupo.rotation.x = Math.PI / 2;
  grupo.updateMatrixWorld(true);
  return grupo;
}

export async function exportarGLB(objeto) {
  const binario = await new GLTFExporter().parseAsync(objeto, { binary: true });
  return new Blob([binario], { type: 'model/gltf-binary' });
}

export function exportarSTL(objeto, alturaMm) {
  const datos = new STLExporter().parse(preparar(objeto, alturaMm, true), { binary: true });
  return new Blob([datos], { type: 'model/stl' });
}

export function exportarOBJ(objeto, alturaMm) {
  const texto = new OBJExporter().parse(preparar(objeto, alturaMm, false));
  return new Blob([`# Exportado con FORJA 3D (unidades: mm)\n${texto}`], { type: 'text/plain' });
}
