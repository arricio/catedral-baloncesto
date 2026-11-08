// Utilidades geométricas compartidas: mallas en coordenadas del mundo, soldado de
// vértices, vecindad, colores muestreados de la textura y análisis para impresión.
import * as THREE from 'three';

/** Mallas visibles del objeto (ignora ayudas visuales). */
export function mallasDe(objeto) {
  const r = [];
  objeto.traverse((o) => {
    if (o.isMesh && !o.userData.ayuda && o.visible !== false) r.push(o);
  });
  return r;
}

/** Copia de la geometría con la transformación del mundo aplicada (pose de reposo). */
export function geometriaMundo(malla) {
  malla.updateWorldMatrix(true, false);
  const g = malla.geometry.clone();
  for (const n of ['skinIndex', 'skinWeight']) if (g.attributes[n]) g.deleteAttribute(n);
  g.morphAttributes = {};
  g.applyMatrix4(malla.matrixWorld);
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

/**
 * Suelda vértices con la misma posición (tolerancia relativa al tamaño).
 * @returns {{id: Uint32Array, unicos: Float32Array, n: number}}
 */
export function soldar(pos, tolerancia) {
  const n = pos.length / 3;
  const id = new Uint32Array(n);
  const mapa = new Map();
  const unicos = [];
  const k = 1 / tolerancia;
  for (let i = 0; i < n; i++) {
    const clave = `${Math.round(pos[i * 3] * k)},${Math.round(pos[i * 3 + 1] * k)},${Math.round(pos[i * 3 + 2] * k)}`;
    let u = mapa.get(clave);
    if (u === undefined) {
      u = unicos.length / 3;
      mapa.set(clave, u);
      unicos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
    id[i] = u;
  }
  return { id, unicos: new Float32Array(unicos), n: unicos.length / 3 };
}

/** Vecindad (CSR) a partir de triángulos ya expresados en índices soldados. */
export function vecindad(n, tris) {
  const grado = new Uint32Array(n + 1);
  for (let t = 0; t < tris.length; t += 3) {
    for (let k = 0; k < 3; k++) { grado[tris[t + k]] += 2; }
  }
  const inicio = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) inicio[i + 1] = inicio[i] + grado[i];
  const lleno = inicio.slice(0, n);
  const vec = new Uint32Array(inicio[n]);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    vec[lleno[a]++] = b; vec[lleno[a]++] = c;
    vec[lleno[b]++] = a; vec[lleno[b]++] = c;
    vec[lleno[c]++] = a; vec[lleno[c]++] = b;
  }
  return { inicio, vec };
}

// --- Colores ----------------------------------------------------------------

const cachePixeles = new WeakMap();
function pixelesDe(textura) {
  const img = textura?.image;
  if (!img || !img.width) return null;
  if (cachePixeles.has(img)) return cachePixeles.get(img);
  const max = 1024;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  try {
    g.drawImage(img, 0, 0, w, h);
  } catch {
    return null;
  }
  const datos = { w, h, px: g.getImageData(0, 0, w, h).data };
  cachePixeles.set(img, datos);
  return datos;
}

const aLineal = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const TABLA_LINEAL = Float32Array.from({ length: 256 }, (_, i) => aLineal(i));

/** Colores lineales por vértice (color del material × color de vértice × textura). */
export function coloresDeVertices(malla, geo = malla.geometry) {
  const mat = Array.isArray(malla.material) ? malla.material[0] : malla.material;
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = mat?.color ?? new THREE.Color(1, 1, 1);
  const ac = geo.attributes.color;
  const uv = geo.attributes.uv;
  const tex = mat?.map ? pixelesDe(mat.map) : null;
  const flip = mat?.map?.flipY ?? false;
  for (let i = 0; i < n; i++) {
    let r = base.r, g = base.g, b = base.b;
    if (ac) { r *= ac.getX(i); g *= ac.getY(i); b *= ac.getZ(i); }
    if (tex && uv) {
      let u = uv.getX(i) % 1; if (u < 0) u += 1;
      let v = uv.getY(i) % 1; if (v < 0) v += 1;
      if (flip) v = 1 - v;
      const x = Math.min(tex.w - 1, Math.floor(u * tex.w));
      const y = Math.min(tex.h - 1, Math.floor(v * tex.h));
      const p = (y * tex.w + x) * 4;
      r *= TABLA_LINEAL[tex.px[p]]; g *= TABLA_LINEAL[tex.px[p + 1]]; b *= TABLA_LINEAL[tex.px[p + 2]];
    }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  return col;
}

/**
 * Fusiona todas las mallas en una sola sopa de triángulos con color por vértice
 * (coordenadas del mundo). Útil para estilos, reducción y análisis.
 */
export function fusionarConColores(objeto) {
  const pos = [], col = [], idx = [];
  let base = 0;
  for (const m of mallasDe(objeto)) {
    const g = geometriaMundo(m);
    const c = coloresDeVertices(m, g);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    for (let i = 0; i < c.length; i++) col.push(c[i]);
    const ind = g.index.array;
    for (let i = 0; i < ind.length; i++) idx.push(ind[i] + base);
    base += p.count;
    g.dispose();
  }
  return { posiciones: new Float32Array(pos), colores: new Float32Array(col), indices: new Uint32Array(idx) };
}

export function cajaDe(posiciones) {
  const caja = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < posiciones.length; i += 3) caja.expandByPoint(v.set(posiciones[i], posiciones[i + 1], posiciones[i + 2]));
  return caja;
}

/** Comprueba si la malla es estanca y calcula volumen/superficie (en las unidades dadas). */
export function analizarImpresion(objeto, alturaMm) {
  const { posiciones, indices } = fusionarConColores(objeto);
  const caja = cajaDe(posiciones);
  const tam = caja.getSize(new THREE.Vector3());
  const k = alturaMm / Math.max(tam.y, 1e-9);
  const sold = soldar(posiciones, Math.max(tam.x, tam.y, tam.z) * 1e-5);
  const aristas = new Map();
  let volumen = 0, area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const u = sold.unicos;
  for (let t = 0; t < indices.length; t += 3) {
    const ia = sold.id[indices[t]], ib = sold.id[indices[t + 1]], ic = sold.id[indices[t + 2]];
    if (ia === ib || ib === ic || ia === ic) continue;
    for (const [p, q] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const clave = p < q ? `${p}_${q}` : `${q}_${p}`;
      aristas.set(clave, (aristas.get(clave) ?? 0) + 1);
    }
    a.fromArray(u, ia * 3).multiplyScalar(k);
    b.fromArray(u, ib * 3).multiplyScalar(k);
    c.fromArray(u, ic * 3).multiplyScalar(k);
    volumen += a.dot(b.clone().cross(c)) / 6;
    area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
  }
  let abiertas = 0, noVariedad = 0;
  for (const v of aristas.values()) { if (v === 1) abiertas++; else if (v > 2) noVariedad++; }
  return {
    triangulos: indices.length / 3,
    abiertas,
    noVariedad,
    estanca: abiertas === 0 && noVariedad === 0,
    volumenCm3: Math.abs(volumen) / 1000,
    areaCm2: area / 100,
    medidasMm: tam.clone().multiplyScalar(k),
  };
}

/** Quita índices sin usar y devuelve una geometría compacta con los triángulos pedidos. */
export function subgeometria(geo, caras) {
  const idx = geo.index.array;
  const mapa = new Int32Array(geo.attributes.position.count).fill(-1);
  const nuevos = [];
  let n = 0;
  for (const f of caras) {
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      if (mapa[v] < 0) mapa[v] = n++;
      nuevos.push(mapa[v]);
    }
  }
  const out = new THREE.BufferGeometry();
  for (const [nombre, attr] of Object.entries(geo.attributes)) {
    const tam = attr.itemSize;
    const enteros = nombre === 'skinIndex';
    const arr = enteros ? new Uint16Array(n * tam) : new Float32Array(n * tam);
    for (let v = 0; v < mapa.length; v++) {
      if (mapa[v] < 0) continue;
      for (let j = 0; j < tam; j++) arr[mapa[v] * tam + j] = attr.getComponent(v, j);
    }
    out.setAttribute(nombre, new THREE.BufferAttribute(arr, tam));
  }
  out.setIndex(nuevos);
  return out;
}

// --- Pose de reposo de los huesos --------------------------------------------
// skeleton.pose() falla con esqueletos cuyo «Armature» tiene giro o escala, así que
// guardamos y restauramos la transformación local de reposo de cada hueso.
export function guardarReposo(objeto) {
  objeto?.traverse((o) => {
    if (o.isBone && !o.userData.reposo) {
      o.userData.reposo = { p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray() };
    }
  });
}

export function ponerReposo(objeto) {
  objeto?.traverse((o) => {
    const r = o.isBone && o.userData.reposo;
    if (!r) return;
    o.position.fromArray(r.p);
    o.quaternion.fromArray(r.q);
    o.scale.fromArray(r.s);
  });
  objeto?.updateMatrixWorld(true);
}
