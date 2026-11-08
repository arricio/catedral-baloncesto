// Estilos: vóxel, ladrillos de construcción, low poly, reducción de polígonos y
// materiales (oro, plata, bronce, arcilla, cristal, dibujo animado, holograma…).
import * as THREE from 'three';
import { clone as clonarConHuesos } from 'three/addons/utils/SkeletonUtils.js';
import { fusionarConColores, cajaDe, mallasDe, soldar } from './geometria.js';

export const ESTILOS = [
  { id: 'original', nombre: 'Original', icono: '🎨' },
  { id: 'voxel', nombre: 'Vóxel', icono: '🧊', geometria: true },
  { id: 'ladrillos', nombre: 'Ladrillos', icono: '🧱', geometria: true },
  { id: 'lowpoly', nombre: 'Low poly', icono: '🔷', geometria: true },
  { id: 'dibujo', nombre: 'Dibujo animado', icono: '✏️' },
  { id: 'arcilla', nombre: 'Arcilla', icono: '🏺' },
  { id: 'oro', nombre: 'Oro', icono: '🥇' },
  { id: 'plata', nombre: 'Plata', icono: '🥈' },
  { id: 'bronce', nombre: 'Bronce', icono: '🥉' },
  { id: 'ceramica', nombre: 'Porcelana', icono: '🍶' },
  { id: 'cristal', nombre: 'Cristal', icono: '💎' },
  { id: 'holograma', nombre: 'Holograma', icono: '🛸' },
];

// ---------------------------------------------------------------------------
// Vóxel y ladrillos
// ---------------------------------------------------------------------------
const PALETA_LADRILLOS = [
  '#ffffff', '#a0a5a9', '#6c6e68', '#05131d', '#c91a09', '#720e0f', '#ff698f', '#fe8a18',
  '#f2cd37', '#e4cd9e', '#958a73', '#aa7d55', '#582a12', '#4b9f4a', '#237841', '#bbe90b',
  '#0055bf', '#36aebf', '#0a3463', '#ac78ba', '#fc97ac', '#a0bcac',
].map((h) => new THREE.Color(h));

const aSRGB = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function cuantizarLadrillo(r, g, b) {
  // Comparación en sRGB (más parecida a como vemos los colores) y ponderada.
  const c = [aSRGB(r), aSRGB(g), aSRGB(b)];
  let mejor = PALETA_LADRILLOS[0], dmin = Infinity;
  for (const p of PALETA_LADRILLOS) {
    const q = [aSRGB(p.r), aSRGB(p.g), aSRGB(p.b)];
    const d = 3 * (q[0] - c[0]) ** 2 + 4 * (q[1] - c[1]) ** 2 + 2 * (q[2] - c[2]) ** 2;
    if (d < dmin) { dmin = d; mejor = p; }
  }
  return mejor;
}

/**
 * Convierte el objeto en vóxeles (o ladrillos con tetones) macizos y cerrados.
 * @param {number} resolucion número de cubos en la dimensión mayor
 */
export function voxelizar(objeto, resolucion = 48, { ladrillos = false } = {}) {
  const { posiciones: P, colores: C, indices: I } = fusionarConColores(objeto);
  const caja = cajaDe(P);
  const tam = caja.getSize(new THREE.Vector3());
  const lado = Math.max(tam.x, tam.y, tam.z) / resolucion;
  const alto = ladrillos ? lado * 1.2 : lado;
  const nx = Math.ceil(tam.x / lado) + 3, ny = Math.ceil(tam.y / alto) + 3, nz = Math.ceil(tam.z / lado) + 3;
  const o = caja.min.clone().sub(new THREE.Vector3(lado, alto, lado));
  const N = nx * ny * nz;
  const sup = new Uint8Array(N);
  const suma = new Float32Array(N * 4);
  const celda = (x, y, z) => {
    const i = Math.floor((x - o.x) / lado), j = Math.floor((y - o.y) / alto), k = Math.floor((z - o.z) / lado);
    return i + nx * (j + ny * k);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < I.length; t += 3) {
    const ia = I[t], ib = I[t + 1], ic = I[t + 2];
    a.fromArray(P, ia * 3); b.fromArray(P, ib * 3); c.fromArray(P, ic * 3);
    const lmax = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const n = Math.max(1, Math.ceil(lmax / (Math.min(lado, alto) * 0.45)));
    for (let u = 0; u <= n; u++) {
      for (let v = 0; v <= n - u; v++) {
        const wa = u / n, wb = v / n, wc = 1 - wa - wb;
        const x = a.x * wa + b.x * wb + c.x * wc;
        const y = a.y * wa + b.y * wb + c.y * wc;
        const z = a.z * wa + b.z * wb + c.z * wc;
        const id = celda(x, y, z);
        sup[id] = 1;
        suma[id * 4] += C[ia * 3] * wa + C[ib * 3] * wb + C[ic * 3] * wc;
        suma[id * 4 + 1] += C[ia * 3 + 1] * wa + C[ib * 3 + 1] * wb + C[ic * 3 + 1] * wc;
        suma[id * 4 + 2] += C[ia * 3 + 2] * wa + C[ib * 3 + 2] * wb + C[ic * 3 + 2] * wc;
        suma[id * 4 + 3] += 1;
      }
    }
  }
  // Relleno: todo lo que no sea alcanzable desde el exterior es macizo.
  const fuera = new Uint8Array(N);
  const pila = [0];
  fuera[0] = 1;
  while (pila.length) {
    const id = pila.pop();
    const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
    const vec = [[i - 1, j, k], [i + 1, j, k], [i, j - 1, k], [i, j + 1, k], [i, j, k - 1], [i, j, k + 1]];
    for (const [x, y, z] of vec) {
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
      const n = x + nx * (y + ny * z);
      if (!fuera[n] && !sup[n]) { fuera[n] = 1; pila.push(n); }
    }
  }
  const color = (id) => {
    const n = suma[id * 4 + 3];
    let col = n ? new THREE.Color(suma[id * 4] / n, suma[id * 4 + 1] / n, suma[id * 4 + 2] / n) : new THREE.Color(0.6, 0.6, 0.6);
    if (ladrillos) col = cuantizarLadrillo(col.r, col.g, col.b);
    return col;
  };
  const pos = [], nor = [], col = [];
  const CARAS = [
    { d: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { d: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { d: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { d: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { d: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  // Color de cada celda maciza: el de la superficie o el del vecino superficial.
  const colorCelda = (i, j, k) => color(i + nx * (j + ny * k));
  const tetones = [];
  const SEG = 12;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const id = i + nx * (j + ny * k);
    if (fuera[id]) continue;
    const cc = colorCelda(i, j, k);
    const x0 = o.x + i * lado, y0 = o.y + j * alto, z0 = o.z + k * lado;
    for (const cara of CARAS) {
      const [dx, dy, dz] = cara.d;
      const n = (i + dx) + nx * ((j + dy) + ny * (k + dz));
      const vecinoFuera = i + dx < 0 || j + dy < 0 || k + dz < 0 || i + dx >= nx || j + dy >= ny || k + dz >= nz || fuera[n];
      if (!vecinoFuera) continue;
      const v = cara.v.map(([a1, b1, c1]) => [x0 + a1 * lado, y0 + b1 * alto, z0 + c1 * lado]);
      for (const q of [0, 1, 2, 0, 2, 3]) { pos.push(...v[q]); nor.push(dx, dy, dz); col.push(cc.r, cc.g, cc.b); }
      if (ladrillos && dy === 1) tetones.push([x0 + lado / 2, y0 + alto, z0 + lado / 2, cc]);
    }
  }
  // Tetones (cilindros con tapa) sobre las caras superiores visibles.
  const rt = lado * 0.3, ht = alto * 0.17;
  for (const [cx, cy, cz, cc] of tetones) {
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2, a1 = ((s + 1) / SEG) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * rt, cz + Math.sin(a0) * rt];
      const p1 = [cx + Math.cos(a1) * rt, cz + Math.sin(a1) * rt];
      const n0 = [Math.cos(a0), 0, Math.sin(a0)], n1 = [Math.cos(a1), 0, Math.sin(a1)];
      const quad = [[p0, cy, n0], [p1, cy + ht, n1], [p1, cy, n1], [p0, cy, n0], [p0, cy + ht, n0], [p1, cy + ht, n1]];
      for (const [[x, z], y, n] of quad) { pos.push(x, y, z); nor.push(...n); col.push(cc.r, cc.g, cc.b); }
      for (const [x, z] of [[cx, cz], [p1[0], p1[1]], [p0[0], p0[1]]]) { pos.push(x, cy + ht, z); nor.push(0, 1, 0); col.push(cc.r * 1.05, cc.g * 1.05, cc.b * 1.05); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ladrillos ? 0.32 : 0.75, metalness: 0 });
  const malla = new THREE.Mesh(geo, mat);
  malla.name = ladrillos ? 'ladrillos' : 'voxel';
  return malla;
}

// ---------------------------------------------------------------------------
// Reducción de polígonos (agrupamiento en rejilla) y low poly
// ---------------------------------------------------------------------------
function agrupar(P, C, I, R, caja) {
  const tam = caja.getSize(new THREE.Vector3());
  const lado = Math.max(tam.x, tam.y, tam.z) / R;
  const n = P.length / 3;
  const celdaDe = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor((P[i * 3] - caja.min.x) / lado);
    const b = Math.floor((P[i * 3 + 1] - caja.min.y) / lado);
    const c = Math.floor((P[i * 3 + 2] - caja.min.z) / lado);
    celdaDe[i] = a + (R + 2) * (b + (R + 2) * c);
  }
  return celdaDe;
}

function contarTriangulos(celdaDe, I) {
  let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = celdaDe[I[t]], b = celdaDe[I[t + 1]], c = celdaDe[I[t + 2]];
    if (a !== b && b !== c && a !== c) n++;
  }
  return n;
}

/**
 * Reduce la malla a ~objetivo triángulos con color por vértice (la textura se
 * convierte en colores). `plano` = sombreado facetado tipo low poly.
 */
export function reducir(objeto, objetivo, { plano = false } = {}) {
  const datos = fusionarConColores(objeto);
  // Primero se sueldan los vértices duplicados de las costuras (UV, cierres): si no,
  // la reducción abriría grietas entre las dos copias.
  const caja = cajaDe(datos.posiciones);
  const tamCaja = caja.getSize(new THREE.Vector3());
  const sold = soldar(datos.posiciones, Math.max(tamCaja.x, tamCaja.y, tamCaja.z) * 1e-5);
  const P = sold.unicos;
  const C = new Float32Array(sold.n * 3);
  const usos = new Float32Array(sold.n);
  for (let i = 0; i < sold.id.length; i++) {
    const u = sold.id[i];
    usos[u]++;
    for (let j = 0; j < 3; j++) C[u * 3 + j] += datos.colores[i * 3 + j];
  }
  for (let u = 0; u < sold.n; u++) for (let j = 0; j < 3; j++) C[u * 3 + j] /= usos[u] || 1;
  const I = new Uint32Array(datos.indices.length);
  for (let i = 0; i < I.length; i++) I[i] = sold.id[datos.indices[i]];
  const actuales = I.length / 3;
  let celdaDe;
  if (objetivo >= actuales) {
    celdaDe = null;
  } else {
    let lo = 4, hi = 2048, mejor = null;
    for (let it = 0; it < 14 && lo <= hi; it++) {
      const R = Math.round((lo + hi) / 2);
      const c = agrupar(P, C, I, R, caja);
      const n = contarTriangulos(c, I);
      if (n > objetivo) hi = R - 1; else { mejor = c; lo = R + 1; }
    }
    celdaDe = mejor ?? agrupar(P, C, I, 4, caja);
  }
  const nuevaPos = [], nuevaCol = [], cuenta = [];
  const mapa = new Map();
  const n = P.length / 3;
  const id = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const clave = celdaDe ? celdaDe[i] : i;
    let k = mapa.get(clave);
    if (k === undefined) { k = cuenta.length; mapa.set(clave, k); cuenta.push(0); nuevaPos.push(0, 0, 0); nuevaCol.push(0, 0, 0); }
    id[i] = k;
    cuenta[k]++;
    for (let j = 0; j < 3; j++) { nuevaPos[k * 3 + j] += P[i * 3 + j]; nuevaCol[k * 3 + j] += C[i * 3 + j]; }
  }
  for (let k = 0; k < cuenta.length; k++) for (let j = 0; j < 3; j++) { nuevaPos[k * 3 + j] /= cuenta[k]; nuevaCol[k * 3 + j] /= cuenta[k]; }
  const tris = [];
  const vistos = new Set();
  for (let t = 0; t < I.length; t += 3) {
    const a = id[I[t]], b = id[I[t + 1]], c = id[I[t + 2]];
    if (a === b || b === c || a === c) continue;
    const s = [a, b, c].sort((x, y) => x - y).join('_');
    if (vistos.has(s)) continue;
    vistos.add(s);
    tris.push(a, b, c);
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(nuevaPos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(nuevaCol, 3));
  geo.setIndex(tris);
  if (plano) {
    geo = geo.toNonIndexed();
    // Un color por cara (media de sus vértices), como en el low poly clásico.
    const cc = geo.attributes.color;
    for (let f = 0; f < cc.count; f += 3) {
      for (let j = 0; j < 3; j++) {
        const m = (cc.getComponent(f, j) + cc.getComponent(f + 1, j) + cc.getComponent(f + 2, j)) / 3;
        for (let k = 0; k < 3; k++) cc.setComponent(f + k, j, m);
      }
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: plano });
  const malla = new THREE.Mesh(geo, mat);
  malla.name = plano ? 'lowpoly' : 'reducido';
  return malla;
}

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------
function materialPara(id, original) {
  const mapa = original?.map ?? null;
  const conColores = original?.vertexColors ?? false;
  switch (id) {
    case 'oro': return new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 1, roughness: 0.22 });
    case 'plata': return new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 });
    case 'bronce': return new THREE.MeshStandardMaterial({ color: 0xb0743a, metalness: 0.95, roughness: 0.38 });
    case 'arcilla': return new THREE.MeshStandardMaterial({ color: 0xc27b55, roughness: 0.95, metalness: 0 });
    case 'ceramica': return new THREE.MeshPhysicalMaterial({ color: 0xf6f3ee, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    case 'cristal': return new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.04, transmission: 1, thickness: 0.4, ior: 1.5, metalness: 0 });
    case 'holograma': return new THREE.MeshBasicMaterial({ color: 0x38e1ff, wireframe: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    case 'dibujo': {
      const m = new THREE.MeshToonMaterial({ color: original?.color?.clone() ?? new THREE.Color(1, 1, 1), map: mapa, vertexColors: conColores });
      const tonos = new Uint8Array([150, 215, 255]);
      const grad = new THREE.DataTexture(tonos, 3, 1, THREE.RedFormat);
      grad.needsUpdate = true;
      m.gradientMap = grad;
      m.toneMapped = false;
      return m;
    }
    default: return null;
  }
}

/** Devuelve una copia del objeto con el material del estilo (y contorno para «dibujo»). */
export function aplicarMaterial(objeto, id) {
  const copia = clonarConHuesos(objeto);
  quitarContornos(copia);
  const contornos = [];
  copia.traverse((o) => {
    if (!o.isMesh || o.userData.ayuda) return;
    const original = Array.isArray(o.material) ? o.material[0] : o.material;
    const m = materialPara(id, original);
    if (m) o.material = m;
    if (id === 'dibujo' && !o.isSkinnedMesh) contornos.push(o);
  });
  const cajaTotal = new THREE.Box3().setFromObject(copia);
  const grosorMundo = cajaTotal.getSize(new THREE.Vector3()).length() * 0.006;
  for (const o of contornos) {
    // Casco invertido: la malla empujada hacia fuera por sus normales, en negro y por detrás.
    const g = o.geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    o.updateWorldMatrix(true, false);
    const escala = new THREE.Vector3().setFromMatrixScale(o.matrixWorld).x || 1;
    const t = grosorMundo / escala;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
    }
    for (const nombre of Object.keys(g.attributes)) if (!['position', 'normal'].includes(nombre)) g.deleteAttribute(nombre);
    const borde = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide }));
    borde.name = 'contorno';
    borde.userData.contorno = true;
    borde.userData.ayuda = true;
    o.add(borde);
  }
  return copia;
}

export function quitarContornos(objeto) {
  const quitar = [];
  objeto.traverse((o) => { if (o.userData.contorno) quitar.push(o); });
  quitar.forEach((o) => o.removeFromParent());
}

export function aplicarEstilo(objeto, id, { resolucion = 48 } = {}) {
  if (id === 'voxel') return voxelizar(objeto, resolucion);
  if (id === 'ladrillos') return voxelizar(objeto, Math.round(resolucion * 0.6), { ladrillos: true });
  if (id === 'lowpoly') return reducir(objeto, Math.max(200, resolucion * 40), { plano: true });
  return aplicarMaterial(objeto, id);
}

export { mallasDe };
