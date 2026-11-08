// Rigging automático en el navegador: estima un esqueleto (humanoide, cuadrúpedo
// u objeto), calcula los pesos de piel y convierte el modelo en SkinnedMesh.
// También interpreta esqueletos ajenos (de la IA o de archivos) asignando roles.
import * as THREE from 'three';
import { mallasDe, geometriaMundo, soldar, vecindad, guardarReposo } from './geometria.js';

export const TIPOS_RIG = {
  humanoide: 'Humanoide (bípedo)',
  cuadrupedo: 'Cuadrúpedo (animal)',
  objeto: 'Objeto o criatura simple',
};

// ---------------------------------------------------------------------------
// Muestreo de puntos y medidas
// ---------------------------------------------------------------------------
/** Puntos repartidos uniformemente por la superficie (por área), no solo los vértices. */
function puntosDe(objeto, total = 60000) {
  const tris = [];
  let area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const m of mallasDe(objeto)) {
    const g = geometriaMundo(m);
    const p = g.attributes.position;
    const idx = g.index.array;
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(p, idx[t]); b.fromBufferAttribute(p, idx[t + 1]); c.fromBufferAttribute(p, idx[t + 2]);
      const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      if (ar <= 0) continue;
      area += ar;
      tris.push(area, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    g.dispose();
  }
  const out = new Float32Array(total * 3);
  if (!tris.length) return new Float32Array(0);
  // Generador pseudoaleatorio fijo: el mismo modelo da siempre el mismo esqueleto.
  let semilla = 12345;
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
  const n = tris.length / 10;
  for (let i = 0; i < total; i++) {
    const objetivo = azar() * area;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid * 10] < objetivo) lo = mid + 1; else hi = mid; }
    const k = lo * 10;
    let u = azar(), v = azar();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    out[i * 3] = tris[k + 1] * w + tris[k + 4] * u + tris[k + 7] * v;
    out[i * 3 + 1] = tris[k + 2] * w + tris[k + 5] * u + tris[k + 8] * v;
    out[i * 3 + 2] = tris[k + 3] * w + tris[k + 6] * u + tris[k + 9] * v;
  }
  return out;
}

class Nube {
  constructor(p) {
    this.p = p;
    this.n = p.length / 3;
    const caja = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) caja.expandByPoint(v.fromArray(p, i * 3));
    this.caja = caja;
    this.min = caja.min; this.max = caja.max;
    this.H = Math.max(1e-6, caja.max.y - caja.min.y);
    this.W = Math.max(1e-6, caja.max.x - caja.min.x);
    this.L = Math.max(1e-6, caja.max.z - caja.min.z);
    this.cx = (caja.min.x + caja.max.x) / 2;
    this.cz = (caja.min.z + caja.max.z) / 2;
  }
  y(f) { return this.min.y + f * this.H; }
  /** Puntos con y en [y(a), y(b)] que cumplen el filtro. */
  banda(a, b, filtro) {
    const ya = this.y(a), yb = this.y(b), r = [];
    for (let i = 0; i < this.n; i++) {
      const x = this.p[i * 3], y = this.p[i * 3 + 1], z = this.p[i * 3 + 2];
      if (y >= ya && y <= yb && (!filtro || filtro(x, y, z))) r.push([x, y, z]);
    }
    return r;
  }
  /** Tramo continuo ocupado en X alrededor de un centro (tronco sin brazos separados). */
  tramo(pts, centro) {
    if (pts.length < 5) return null;
    const B = 64, x0 = this.min.x, ancho = this.W / B;
    const cuenta = new Uint32Array(B);
    for (const [x] of pts) cuenta[Math.min(B - 1, Math.max(0, Math.floor((x - x0) / ancho)))]++;
    const umbral = Math.max(1, pts.length * 0.003);
    let c = Math.min(B - 1, Math.max(0, Math.floor((centro - x0) / ancho)));
    if (cuenta[c] < umbral) {
      // busca la celda ocupada más cercana al centro
      let mejor = -1;
      for (let d = 1; d < B && mejor < 0; d++) {
        if (c - d >= 0 && cuenta[c - d] >= umbral) mejor = c - d;
        else if (c + d < B && cuenta[c + d] >= umbral) mejor = c + d;
      }
      if (mejor < 0) return null;
      c = mejor;
    }
    let i = c, j = c;
    while (i > 0 && cuenta[i - 1] >= umbral) i--;
    while (j < B - 1 && cuenta[j + 1] >= umbral) j++;
    return [x0 + i * ancho, x0 + (j + 1) * ancho];
  }
}

const media = (pts, k) => pts.reduce((s, p) => s + p[k], 0) / Math.max(1, pts.length);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Estimación de articulaciones
// ---------------------------------------------------------------------------
/**
 * @returns {{tipo:string, articulaciones: Array<{nombre, padre, pos: THREE.Vector3, rol, lado, extra}>}}
 */
export function estimarArticulaciones(objeto, tipo) {
  const nube = new Nube(puntosDe(objeto));
  if (tipo === 'humanoide') return { tipo, articulaciones: humanoide(nube) };
  if (tipo === 'cuadrupedo') return { tipo, articulaciones: cuadrupedo(nube) };
  return { tipo: 'objeto', articulaciones: cadena(nube) };
}

function humanoide(n) {
  const { H, cx } = n;
  // Cuello: el tramo central más estrecho entre el 72 % y el 94 % de la altura.
  let cuelloF = 0.86, minAncho = Infinity;
  for (let f = 0.72; f <= 0.94; f += 0.01) {
    const t = n.tramo(n.banda(f - 0.012, f + 0.012), cx);
    if (!t) continue;
    const w = t[1] - t[0];
    if (w < minAncho * 0.98) { minAncho = w; cuelloF = f; }
  }
  // Entrepierna: la primera altura (desde abajo) en que el centro deja de estar vacío.
  let entreF = 0.45;
  const anchoCentro = n.W * 0.03;
  let vistoHueco = false;
  for (let f = 0.06; f <= 0.66; f += 0.01) {
    const centro = n.banda(f - 0.01, f + 0.01, (x) => Math.abs(x - cx) < anchoCentro).length;
    if (centro < 3) vistoHueco = true;
    else if (vistoHueco) { entreF = f; break; }
  }
  if (!vistoHueco) entreF = 0.45;
  entreF = Math.min(0.62, Math.max(0.18, entreF));
  const caderaF = Math.min(0.66, entreF + 0.04);
  const hombroF = Math.max(caderaF + 0.12, cuelloF - 0.05);

  // Tronco: anchura a la altura del pecho.
  const tPecho = n.tramo(n.banda(hombroF - 0.09, hombroF - 0.03), cx) ?? [cx - n.W * 0.18, cx + n.W * 0.18];
  const cxT = (tPecho[0] + tPecho[1]) / 2;
  const medio = Math.max(H * 0.04, (tPecho[1] - tPecho[0]) / 2);
  const zEn = (f, ancho = medio * 0.7) => {
    const pts = n.banda(f - 0.03, f + 0.03, (x) => Math.abs(x - cxT) < ancho);
    return pts.length ? media(pts, 2) : n.cz;
  };

  const A = [];
  const add = (nombre, padre, pos, rol, lado = 0, extra = {}) => A.push({ nombre, padre, pos, rol, lado, extra });
  const yC = n.y(caderaF), yH = n.y(hombroF), yN = n.y(cuelloF);
  add('cadera', null, V(cxT, yC, zEn(caderaF)), 'raiz');
  add('columna', 'cadera', V(cxT, yC + (yH - yC) * 0.35, zEn(caderaF + (hombroF - caderaF) * 0.35)), 'columna');
  add('pecho', 'columna', V(cxT, yC + (yH - yC) * 0.72, zEn(caderaF + (hombroF - caderaF) * 0.72)), 'pecho');
  add('cuello', 'pecho', V(cxT, yN - 0.025 * H, zEn(cuelloF - 0.025, medio * 0.5)), 'cuello');
  add('cabeza', 'cuello', V(cxT, yN + 0.02 * H, zEn(cuelloF + 0.02, medio * 0.6)), 'cabeza');
  add('cabeza_fin', 'cabeza', V(cxT, n.max.y, zEn(Math.min(0.99, cuelloF + 0.08), medio)), 'hoja');

  for (const [lado, suf] of [[1, 'i'], [-1, 'd']]) {
    // Brazo: puntos por encima de la cadera y fuera del tronco.
    const fuera = medio * 1.12;
    const brazo = n.banda(caderaF - 0.05, Math.min(1, cuelloF + 0.05), (x) => lado * (x - cxT) > fuera);
    const hombro = V(cxT + lado * medio * 0.85, yH, zEn(hombroF));
    let punta;
    if (brazo.length > 40) {
      let maxD = 0;
      for (const p of brazo) maxD = Math.max(maxD, lado * (p[0] - cxT));
      const ext = brazo.filter((p) => lado * (p[0] - cxT) > maxD - (maxD - fuera) * 0.12);
      punta = V(media(ext, 0), media(ext, 1), media(ext, 2));
      if (punta.distanceTo(hombro) < H * 0.12) punta = null;
    }
    if (!punta) punta = V(cxT + lado * (medio + H * 0.05), yC - H * 0.04, hombro.z); // brazos pegados al cuerpo
    const codo = hombro.clone().lerp(punta, 0.48);
    const muneca = hombro.clone().lerp(punta, 0.86);
    add(`clavicula_${suf}`, 'pecho', V(cxT + lado * medio * 0.25, yH + 0.01 * H, hombro.z), 'clavicula', lado);
    add(`brazo_${suf}`, `clavicula_${suf}`, hombro, 'brazo', lado);
    add(`antebrazo_${suf}`, `brazo_${suf}`, codo, 'antebrazo', lado);
    add(`mano_${suf}`, `antebrazo_${suf}`, muneca, 'mano', lado);
    add(`mano_fin_${suf}`, `mano_${suf}`, punta, 'hoja', lado);

    // Pierna
    const lado2 = (x) => lado * (x - cxT) > n.W * 0.01;
    const muslo = n.banda(entreF * 0.55, entreF * 0.95, lado2);
    const rodillaPts = n.banda(entreF * 0.4, entreF * 0.6, lado2);
    const pies = n.banda(0, 0.06, lado2);
    const xl = muslo.length ? media(muslo, 0) : cxT + lado * medio * 0.5;
    const xp = pies.length ? media(pies, 0) : xl;
    const zr = rodillaPts.length ? media(rodillaPts, 2) : n.cz;
    const zt = pies.length ? media(pies, 2) : zr;
    const zPunta = pies.length ? Math.max(...pies.map((p) => p[2])) : zt + H * 0.06;
    add(`muslo_${suf}`, 'cadera', V(xl, yC - 0.02 * H, zEn(caderaF)), 'muslo', lado);
    add(`pierna_${suf}`, `muslo_${suf}`, V((xl + xp) / 2, n.y(entreF * 0.5), zr), 'pierna', lado);
    add(`pie_${suf}`, `pierna_${suf}`, V(xp, n.y(0.055), zt), 'pie', lado);
    add(`pie_fin_${suf}`, `pie_${suf}`, V(xp, n.y(0.01), Math.max(zPunta - H * 0.01, zt + H * 0.02)), 'hoja', lado);
  }
  return A;
}

function cuadrupedo(n) {
  const { H, L, cx } = n;
  // Panza: primera altura en la que la zona central del cuerpo está ocupada.
  let panzaF = 0.4;
  for (let f = 0.08; f <= 0.8; f += 0.01) {
    const c = n.banda(f - 0.01, f + 0.01, (x, y, z) => Math.abs(x - cx) < n.W * 0.15 && Math.abs(z - n.cz) < L * 0.15).length;
    if (c > 4) { panzaF = f; break; }
  }
  const yHueso = n.y(Math.min(0.85, panzaF + 0.12));
  const pies = n.banda(0, 0.15);
  const zMedio = pies.length ? media(pies, 2) : n.cz;
  const cuadrante = (sx, sz) => {
    const pts = pies.filter((p) => sx * (p[0] - cx) > 0 && sz * (p[2] - zMedio) > 0);
    return pts.length > 3
      ? V(media(pts, 0), 0, media(pts, 2))
      : V(cx + sx * n.W * 0.3, 0, n.cz + sz * L * 0.3);
  };
  const patas = {
    del_i: cuadrante(1, 1), del_d: cuadrante(-1, 1),
    tras_i: cuadrante(1, -1), tras_d: cuadrante(-1, -1),
  };
  const zDel = (patas.del_i.z + patas.del_d.z) / 2;
  const zTras = (patas.tras_i.z + patas.tras_d.z) / 2;

  const A = [];
  const add = (nombre, padre, pos, rol, lado = 0, extra = {}) => A.push({ nombre, padre, pos, rol, lado, extra });
  add('pelvis', null, V(cx, yHueso, zTras), 'raiz');
  add('columna', 'pelvis', V(cx, yHueso + H * 0.02, (zTras + zDel) / 2), 'columna');
  add('pecho', 'columna', V(cx, yHueso, zDel), 'pecho');

  // Cabeza: la zona más adelantada.
  const delante = n.banda(0.2, 1, (x, y, z) => z > n.max.z - L * 0.16);
  const cab = delante.length ? V(media(delante, 0), media(delante, 1), media(delante, 2)) : V(cx, n.y(0.8), n.max.z - L * 0.08);
  add('cuello', 'pecho', V(cx, yHueso + (cab.y - yHueso) * 0.5, zDel + (cab.z - zDel) * 0.45), 'cuello');
  add('cabeza', 'cuello', V(cx, cab.y, cab.z - L * 0.05), 'cabeza');
  add('cabeza_fin', 'cabeza', V(cx, cab.y, n.max.z), 'hoja');

  // Cola: puntos detrás de las patas traseras y por encima de la panza.
  const cola = n.banda(panzaF, 1, (x, y, z) => z < zTras - L * 0.1);
  if (cola.length > 25) {
    let zmin = Infinity, fin = null;
    for (const p of cola) if (p[2] < zmin) { zmin = p[2]; fin = p; }
    const ini = V(cx, yHueso, zTras - L * 0.06);
    const finV = V(fin[0], fin[1], fin[2]);
    add('cola_1', 'pelvis', ini, 'cola', 0, { indice: 0 });
    add('cola_2', 'cola_1', ini.clone().lerp(finV, 0.5), 'cola', 0, { indice: 1 });
    add('cola_fin', 'cola_2', finV, 'hoja');
  }

  for (const [clave, pie] of Object.entries(patas)) {
    const delantera = clave.startsWith('del');
    const lado = clave.endsWith('_i') ? 1 : -1;
    const padre = delantera ? 'pecho' : 'pelvis';
    const y0 = n.min.y;
    const arriba = V(pie.x, yHueso - H * 0.03, pie.z);
    add(`${clave}_1`, padre, arriba, 'pata', lado, { delantera, segmento: 0 });
    add(`${clave}_2`, `${clave}_1`, V(pie.x, y0 + (arriba.y - y0) * 0.5, pie.z + (delantera ? -0.02 : 0.02) * L), 'pata', lado, { delantera, segmento: 1 });
    add(`${clave}_3`, `${clave}_2`, V(pie.x, y0 + H * 0.05, pie.z), 'pata', lado, { delantera, segmento: 2 });
    add(`${clave}_fin`, `${clave}_3`, V(pie.x, y0, pie.z + L * 0.03), 'hoja', lado);
  }
  return A;
}

function cadena(n) {
  const A = [];
  const pts = n.banda(0, 1);
  const zc = pts.length ? media(pts, 2) : n.cz;
  const fr = [0, 0.25, 0.5, 0.75, 1];
  fr.forEach((f, i) => {
    const nombre = i === fr.length - 1 ? 'punta' : i === 0 ? 'base' : `tramo_${i}`;
    A.push({
      nombre,
      padre: i === 0 ? null : A[i - 1].nombre,
      pos: V(n.cx, n.y(f), zc),
      rol: i === 0 ? 'raiz' : i === fr.length - 1 ? 'hoja' : 'cadena',
      lado: 0,
      extra: { indice: i },
    });
  });
  return A;
}

// ---------------------------------------------------------------------------
// Pesos de piel y construcción del SkinnedMesh
// ---------------------------------------------------------------------------
function distSegmento(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = px - a.x, apy = py - a.y, apz = pz - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? (apx * abx + apy * aby + apz * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Crea el personaje articulado a partir del objeto estático y del plan de articulaciones.
 * @returns {THREE.Group} grupo con huesos y SkinnedMesh; userData.rig con tipo y roles.
 */
export function crearRig(objeto, plan) {
  objeto.updateMatrixWorld(true);
  const arts = plan.articulaciones;
  const porNombre = new Map(arts.map((a, i) => [a.nombre, i]));
  const hijos = arts.map(() => []);
  arts.forEach((a, i) => { if (a.padre) hijos[porNombre.get(a.padre)].push(i); });

  // Segmentos que reciben peso: cada articulación no hoja hacia su hijo principal.
  const segs = [];
  arts.forEach((a, i) => {
    if (a.rol === 'hoja' || !hijos[i].length) return;
    // Hijo principal: el que sigue la misma cadena (preferimos el de igual lado y rol de cadena).
    const prefer = ['columna', 'pecho', 'cuello', 'cabeza', 'antebrazo', 'mano', 'pierna', 'pie', 'pata', 'cola', 'cadena', 'hoja', 'brazo'];
    let h = hijos[i][0];
    for (const r of prefer) {
      const c = hijos[i].find((j) => arts[j].rol === r && (arts[j].lado === a.lado || a.lado === 0) && (r !== 'brazo' || a.rol === 'clavicula'));
      if (c !== undefined) { h = c; break; }
    }
    segs.push({ hueso: i, a: a.pos, b: arts[h].pos, lado: a.lado, rol: a.rol });
  });

  // Recoge geometría del mundo de todas las mallas y suelda.
  const mallas = mallasDe(objeto);
  const geos = mallas.map((m) => geometriaMundo(m));
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const trisGlob = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { pos[(base + i) * 3] = p.getX(i); pos[(base + i) * 3 + 1] = p.getY(i); pos[(base + i) * 3 + 2] = p.getZ(i); }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) trisGlob.push(idx[i] + base);
    base += p.count;
  }
  const caja = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(pos, 3));
  const H = Math.max(1e-6, caja.max.y - caja.min.y);
  const W = Math.max(1e-6, caja.max.x - caja.min.x);
  const cx = arts[0].pos.x;
  const sold = soldar(pos, H * 1e-5);
  const nU = sold.n;
  const nS = segs.length;

  // Pesos iniciales por distancia (con máscara de lado para no mezclar izquierda y derecha).
  const pesos = new Float32Array(nU * nS);
  const d = new Float32Array(nS);
  for (let v = 0; v < nU; v++) {
    const x = sold.unicos[v * 3], y = sold.unicos[v * 3 + 1], z = sold.unicos[v * 3 + 2];
    const lx = (x - cx) / W;
    let dmin = Infinity;
    for (let s = 0; s < nS; s++) {
      const sg = segs[s];
      let dist = distSegmento(x, y, z, sg.a, sg.b);
      if (sg.lado !== 0 && sg.lado * lx < -0.02) dist += H; // lado contrario: casi prohibido
      d[s] = dist;
      if (dist < dmin) dmin = dist;
    }
    const corte = dmin * 1.6 + H * 0.01;
    let suma = 0;
    for (let s = 0; s < nS; s++) {
      if (d[s] > corte) continue;
      const w = 1 / Math.pow(d[s] + H * 0.004, 4);
      pesos[v * nS + s] = w; suma += w;
    }
    for (let s = 0; s < nS; s++) pesos[v * nS + s] /= suma || 1;
  }

  // Suavizado sobre la superficie para transiciones limpias en las articulaciones.
  const trisU = new Uint32Array(trisGlob.length);
  for (let i = 0; i < trisGlob.length; i++) trisU[i] = sold.id[trisGlob[i]];
  const { inicio, vec } = vecindad(nU, trisU);
  let actual = pesos;
  for (let it = 0; it < 3; it++) {
    const sig = new Float32Array(nU * nS);
    for (let v = 0; v < nU; v++) {
      const a = inicio[v], b = inicio[v + 1];
      const k = b - a;
      for (let s = 0; s < nS; s++) {
        let acc = actual[v * nS + s] * k;
        for (let j = a; j < b; j++) acc += actual[vec[j] * nS + s];
        sig[v * nS + s] = acc / (2 * k || 1);
      }
    }
    actual = sig;
  }

  // Top-4 por vértice soldado.
  const idx4 = new Uint16Array(nU * 4);
  const pes4 = new Float32Array(nU * 4);
  for (let v = 0; v < nU; v++) {
    const mejores = [];
    for (let s = 0; s < nS; s++) {
      const w = actual[v * nS + s];
      if (w <= 1e-4) continue;
      mejores.push([w, s]);
    }
    mejores.sort((p, q) => q[0] - p[0]);
    const top = mejores.slice(0, 4);
    const suma = top.reduce((acc, [w]) => acc + w, 0) || 1;
    top.forEach(([w, s], k) => { idx4[v * 4 + k] = segs[s].hueso; pes4[v * 4 + k] = w / suma; });
    if (!top.length) { idx4[v * 4] = 0; pes4[v * 4] = 1; }
  }

  // Huesos.
  const huesos = arts.map((a) => {
    const b = new THREE.Bone();
    b.name = a.nombre;
    return b;
  });
  arts.forEach((a, i) => {
    if (a.padre) {
      const p = porNombre.get(a.padre);
      huesos[p].add(huesos[i]);
      huesos[i].position.copy(a.pos).sub(arts[p].pos);
    } else {
      huesos[i].position.copy(a.pos);
    }
  });
  const raices = arts.map((a, i) => (a.padre ? null : huesos[i])).filter(Boolean);
  const personaje = new THREE.Group();
  personaje.name = 'personaje';
  raices.forEach((r) => personaje.add(r));
  personaje.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(huesos);

  base = 0;
  geos.forEach((g, k) => {
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const u = sold.id[base + i];
      for (let j = 0; j < 4; j++) { si[i * 4 + j] = idx4[u * 4 + j]; sw[i * 4 + j] = pes4[u * 4 + j]; }
    }
    base += n;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (!g.attributes.normal) g.computeVertexNormals();
    const original = mallas[k];
    const sm = new THREE.SkinnedMesh(g, original.material);
    sm.name = original.name || `malla_${k}`;
    sm.castShadow = true;
    sm.receiveShadow = true;
    sm.frustumCulled = false;
    personaje.add(sm);
    sm.bind(esqueleto);
  });

  const roles = {};
  arts.forEach((a) => { roles[a.nombre] = { rol: a.rol, lado: a.lado, ...a.extra }; });
  personaje.userData.rig = { tipo: plan.tipo, roles, origen: 'local' };
  guardarReposo(personaje);
  return personaje;
}

// ---------------------------------------------------------------------------
// Esqueletos ajenos: deduce el papel de cada hueso por su posición
// ---------------------------------------------------------------------------
export function tieneEsqueleto(objeto) {
  let si = false;
  objeto?.traverse((o) => { if (o.isSkinnedMesh) si = true; });
  return si;
}

export function inferirRoles(objeto) {
  objeto.updateMatrixWorld(true);
  const huesosSet = new Set();
  objeto.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b) => huesosSet.add(b)); });
  const huesos = [...huesosSet];
  if (!huesos.length) return null;
  // Nombres únicos (necesario para las pistas de animación).
  const usados = new Set();
  huesos.forEach((b, i) => {
    let nombre = (b.name || `hueso_${i}`).replace(/[.:/\[\]]/g, '_');
    while (usados.has(nombre)) nombre += '_';
    usados.add(nombre);
    b.name = nombre;
  });
  const esHueso = (o) => huesosSet.has(o);
  const hijos = new Map(huesos.map((b) => [b, b.children.filter(esHueso)]));
  const raices = huesos.filter((b) => !esHueso(b.parent));
  const contar = (b) => 1 + hijos.get(b).reduce((s, h) => s + contar(h), 0);
  const raiz = raices.sort((a, b) => contar(b) - contar(a))[0];
  const pos = new Map(huesos.map((b) => [b, b.getWorldPosition(new THREE.Vector3())]));

  const caja = new THREE.Box3().setFromObject(objeto);
  const H = Math.max(1e-6, caja.max.y - caja.min.y);
  const W = Math.max(1e-6, caja.max.x - caja.min.x);
  const L = Math.max(1e-6, caja.max.z - caja.min.z);
  const cx = pos.get(raiz).x, cz = (caja.min.z + caja.max.z) / 2;

  // Cadenas raíz→hoja; la extremidad empieza tras la última bifurcación.
  const extremidades = [];
  const recorrer = (b, camino) => {
    const c = [...camino, b];
    const hs = hijos.get(b);
    if (!hs.length) {
      let corte = 0;
      for (let i = c.length - 2; i >= 0; i--) if (hijos.get(c[i]).length > 1) { corte = i + 1; break; }
      extremidades.push({ huesos: c.slice(corte), camino: c, hoja: pos.get(b) });
    }
    hs.forEach((h) => recorrer(h, c));
  };
  recorrer(raiz, []);

  const roles = {};
  const poner = (b, rol, lado = 0, extra = {}) => { roles[b.name] = { rol, lado, ...extra }; };
  const piernas = [], brazos = [];
  let cabeza = null;
  for (const e of extremidades) {
    const { hoja } = e;
    if (e.huesos.length === 0 || (e.huesos.length === 1 && e.huesos[0] === raiz)) continue;
    if (hoja.y < caja.min.y + 0.2 * H) piernas.push(e);
    else if (Math.abs(hoja.x - cx) > 0.22 * W && hoja.y < caja.min.y + 0.92 * H) brazos.push(e);
    else if (!cabeza || hoja.y > cabeza.hoja.y) cabeza = e;
  }
  const cuadrupedo = piernas.length >= 4;
  const tipo = cuadrupedo ? 'cuadrupedo' : piernas.length >= 2 ? 'humanoide' : 'objeto';

  if (tipo === 'objeto') {
    // Todas las cadenas ondulan según su profundidad.
    huesos.forEach((b) => {
      let prof = 0, p = b;
      while (esHueso(p.parent)) { prof++; p = p.parent; }
      poner(b, b === raiz ? 'raiz' : 'cadena', 0, { indice: prof });
    });
  } else {
    poner(raiz, 'raiz');
    // Columna: camino hasta la cabeza (o hasta la bifurcación más alta).
    if (cabeza) {
      const inicioCab = cabeza.huesos[0];
      const idx = cabeza.camino.indexOf(inicioCab);
      const columna = cabeza.camino.slice(1, idx);
      columna.forEach((b, i) => poner(b, i === columna.length - 1 ? 'pecho' : 'columna'));
      cabeza.huesos.forEach((b, i) => poner(b, i === 0 && cabeza.huesos.length > 1 ? 'cuello' : 'cabeza'));
    }
    for (const e of piernas) {
      const lado = Math.sign(e.hoja.x - cx) || 1;
      if (cuadrupedo) {
        const delantera = e.hoja.z > cz;
        e.huesos.forEach((b, i) => poner(b, 'pata', lado, { delantera, segmento: Math.min(2, i) }));
      } else {
        const nombres = ['muslo', 'pierna', 'pie', 'pie'];
        e.huesos.forEach((b, i) => poner(b, nombres[Math.min(3, i)], lado));
      }
    }
    for (const e of brazos) {
      const lado = Math.sign(e.hoja.x - cx) || 1;
      const seq = e.huesos.length >= 4 ? ['clavicula', 'brazo', 'antebrazo', 'mano'] : ['brazo', 'antebrazo', 'mano'];
      e.huesos.forEach((b, i) => poner(b, seq[Math.min(seq.length - 1, i)], lado));
    }
    // Lo que quede detrás es cola; el resto, apéndices.
    for (const e of extremidades) {
      if (piernas.includes(e) || brazos.includes(e) || e === cabeza) continue;
      const esCola = e.hoja.z < cz - 0.25 * L;
      e.huesos.forEach((b, i) => { if (!roles[b.name]) poner(b, esCola ? 'cola' : 'cadena', 0, { indice: i + 1 }); });
    }
  }
  objeto.userData.rig = { tipo, roles, origen: 'importado' };
  return objeto.userData.rig;
}
