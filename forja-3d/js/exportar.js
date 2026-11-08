// Exportación: GLB (con animaciones), STL, OBJ, PLY con color, USDZ y 3MF.
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { clone as clonarConHuesos } from 'three/addons/utils/SkeletonUtils.js';
import { fusionarConColores, ponerReposo } from './geometria.js';
import { exportarFBX } from './fbx.js';

export const FORMATOS = [
  { id: 'glb', nombre: 'GLB', detalle: 'Con texturas y animaciones · web, Blender, Unity, Unreal' },
  { id: 'stl', nombre: 'STL', detalle: 'Impresión 3D (mm, Z arriba)' },
  { id: '3mf', nombre: '3MF', detalle: 'Impresión 3D moderna (Bambu, Prusa, Cura)' },
  { id: 'fbx', nombre: 'FBX', detalle: 'Blender, Unity, Unreal, Maya (con textura)' },
  { id: 'obj', nombre: 'OBJ', detalle: 'Malla universal' },
  { id: 'ply', nombre: 'PLY', detalle: 'Malla con colores por vértice' },
  { id: 'usdz', nombre: 'USDZ', detalle: 'Realidad aumentada en iPhone y iPad' },
];

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

/** Copia del objeto sin ayudas visuales (contornos, marcadores). */
function copiaLimpia(objeto) {
  const c = clonarConHuesos(objeto);
  // Siempre en la pose de reposo (aunque se esté reproduciendo una animación).
  ponerReposo(c);
  const quitar = [];
  c.traverse((o) => { if (o.userData.ayuda) quitar.push(o); });
  quitar.forEach((o) => o.removeFromParent());
  return c;
}

/** Envuelve el objeto para que su altura (eje Y) mida `alturaMm` y, si se pide, con Z hacia arriba. */
function preparar(objeto, alturaMm, zArriba) {
  const copia = copiaLimpia(objeto);
  ponerReposo(copia);
  copia.position.set(0, 0, 0);
  copia.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(copia);
  const tam = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  const k = alturaMm / Math.max(tam.y, 1e-6);
  const interior = new THREE.Group();
  interior.add(copia);
  interior.position.set(-centro.x, -caja.min.y, -centro.z);
  const grupo = new THREE.Group();
  grupo.add(interior);
  grupo.scale.setScalar(k);
  if (zArriba) grupo.rotation.x = Math.PI / 2;
  grupo.updateMatrixWorld(true);
  return grupo;
}

export async function exportarGLB(objeto, clips = []) {
  const copia = copiaLimpia(objeto);
  const binario = await new GLTFExporter().parseAsync(copia, { binary: true, animations: clips, onlyVisible: true });
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

/** Una sola malla con color por vértice (bakeado de la textura), en mm. */
function mallaColoreada(objeto, alturaMm, zArriba) {
  const grupo = preparar(objeto, alturaMm, zArriba);
  const { posiciones, colores, indices } = fusionarConColores(grupo);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  // PLY guarda los colores tal cual: pasamos de lineal a sRGB.
  const srgb = colores.map((c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  g.setAttribute('color', new THREE.BufferAttribute(srgb, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true }));
}

export async function exportarPLY(objeto, alturaMm) {
  const malla = mallaColoreada(objeto, alturaMm, true);
  const datos = await new Promise((ok) => new PLYExporter().parse(malla, ok, { binary: true }));
  return new Blob([datos], { type: 'application/octet-stream' });
}

export async function exportarUSDZ(objeto) {
  // USDZ no admite esqueletos: se exporta la pose actual con materiales estándar.
  const copia = copiaLimpia(objeto);
  const escena = new THREE.Scene();
  const estatico = new THREE.Group();
  copia.updateMatrixWorld(true);
  copia.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    for (const n of ['skinIndex', 'skinWeight']) if (g.attributes[n]) g.deleteAttribute(n);
    g.applyMatrix4(o.matrixWorld);
    let m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m.isMeshStandardMaterial) {
      m = new THREE.MeshStandardMaterial({ color: m.color ?? 0xffffff, map: m.map ?? null, vertexColors: m.vertexColors });
    }
    estatico.add(new THREE.Mesh(g, m));
  });
  const caja = new THREE.Box3().setFromObject(estatico);
  const tam = caja.getSize(new THREE.Vector3());
  // En AR: 30 cm de alto aproximadamente.
  const k = 0.3 / Math.max(tam.y, 1e-6);
  estatico.scale.setScalar(k);
  estatico.position.set(-caja.getCenter(new THREE.Vector3()).x * k, -caja.min.y * k, -caja.getCenter(new THREE.Vector3()).z * k);
  escena.add(estatico);
  const datos = await new USDZExporter().parseAsync(escena, { quickLookCompatible: true });
  return new Blob([datos], { type: 'model/vnd.usdz+zip' });
}

export function exportar3MF(objeto, alturaMm) {
  const grupo = preparar(objeto, alturaMm, true);
  const { posiciones, indices } = fusionarConColores(grupo);
  const v = [];
  for (let i = 0; i < posiciones.length; i += 3) {
    v.push(`<vertex x="${posiciones[i].toFixed(4)}" y="${posiciones[i + 1].toFixed(4)}" z="${posiciones[i + 2].toFixed(4)}"/>`);
  }
  const t = [];
  for (let i = 0; i < indices.length; i += 3) t.push(`<triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`);
  const modelo = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">FORJA 3D</metadata>
<resources><object id="1" type="model"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object></resources>
<build><item objectid="1"/></build>
</model>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const zip = zipSync({
    '[Content_Types].xml': strToU8(tipos),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(modelo),
  });
  return new Blob([zip], { type: 'model/3mf' });
}

export async function exportarFormato(formato, objeto, { alturaMm = 80, clips = [], glbOriginal = null } = {}) {
  switch (formato) {
    case 'glb': return glbOriginal && !clips.length ? glbOriginal : exportarGLB(objeto, clips);
    case 'stl': return exportarSTL(objeto, alturaMm);
    case 'obj': return exportarOBJ(objeto, alturaMm);
    case 'fbx': return exportarFBX(preparar(objeto, alturaMm, false));
    case 'ply': return exportarPLY(objeto, alturaMm);
    case 'usdz': return exportarUSDZ(objeto);
    case '3mf': return exportar3MF(objeto, alturaMm);
    default: throw new Error(`Formato desconocido: ${formato}`);
  }
}
