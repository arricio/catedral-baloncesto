// Segmentación del modelo en partes: piezas sueltas, zonas del cuerpo (usando el
// esqueleto estimado) o bloques. Cada parte conserva su material y textura.
import * as THREE from 'three';
import { mallasDe, geometriaMundo, soldar, subgeometria } from './geometria.js';
import { estimarArticulaciones } from './rig.js';

export const COLORES_PARTES = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#22b8cf', '#f06595', '#94d82d', '#845ef7', '#ffd43b', '#20c997'];

function recoger(objeto) {
  const mallas = mallasDe(objeto);
  const geos = mallas.map((m) => geometriaMundo(m));
  const pos = [];
  const caras = []; // [malla, cara, v0, v1, v2] en índices globales
  let base = 0;
  geos.forEach((g, mi) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const idx = g.index.array;
    for (let f = 0; f < idx.length / 3; f++) caras.push([mi, f, idx[f * 3] + base, idx[f * 3 + 1] + base, idx[f * 3 + 2] + base]);
    base += p.count;
  });
  const P = new Float32Array(pos);
  const caja = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(P, 3));
  const tam = caja.getSize(new THREE.Vector3());
  const sold = soldar(P, Math.max(tam.x, tam.y, tam.z) * 1e-5);
  return { mallas, geos, caras, sold, caja };
}

function componentes(datos) {
  const { sold, caras } = datos;
  const padre = new Int32Array(sold.n).map((_, i) => i);
  const raiz = (x) => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  const unir = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b; };
  for (const c of caras) { const a = sold.id[c[2]], b = sold.id[c[3]], d = sold.id[c[4]]; unir(a, b); unir(b, d); }
  return caras.map((c) => raiz(sold.id[c[2]]));
}

function zonasCuerpo(datos, objeto, tipo) {
  const { articulaciones: A } = estimarArticulaciones(objeto, tipo);
  const por = new Map(A.map((a) => [a.nombre, a]));
  const grupo = (a) => {
    if (a.rol === 'cabeza' || a.rol === 'cuello') return 'Cabeza';
    if (['brazo', 'antebrazo', 'mano', 'clavicula'].includes(a.rol)) return a.lado > 0 ? 'Brazo izquierdo' : 'Brazo derecho';
    if (['muslo', 'pierna', 'pie'].includes(a.rol)) return a.lado > 0 ? 'Pierna izquierda' : 'Pierna derecha';
    if (a.rol === 'pata') return `${a.extra?.delantera ? 'Pata delantera' : 'Pata trasera'} ${a.lado > 0 ? 'izq.' : 'der.'}`;
    if (a.rol === 'cola') return 'Cola';
    if (a.rol === 'cadena') return `Tramo ${a.extra?.indice ?? ''}`;
    return 'Torso';
  };
  const segs = A.filter((a) => a.rol !== 'hoja').map((a) => {
    const hijo = A.find((h) => h.padre === a.nombre && (h.rol !== 'brazo' || a.rol === 'clavicula') && (h.lado === a.lado || a.lado === 0)) ?? A.find((h) => h.padre === a.nombre);
    return { a: a.pos, b: hijo ? hijo.pos : a.pos, grupo: grupo(a), lado: a.lado };
  });
  void por;
  const cx = A[0].pos.x;
  const W = datos.caja.max.x - datos.caja.min.x;
  const linea = new THREE.Line3();
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const etiquetaV = new Array(datos.sold.n);
  const u = datos.sold.unicos;
  for (let v = 0; v < datos.sold.n; v++) {
    p.fromArray(u, v * 3);
    const lx = (p.x - cx) / W;
    let mejor = null, dmin = Infinity;
    for (const s of segs) {
      linea.set(s.a, s.b);
      linea.closestPointToPoint(p, true, q);
      let d = q.distanceTo(p);
      if (s.lado !== 0 && s.lado * lx < -0.02) d += 10;
      if (d < dmin) { dmin = d; mejor = s.grupo; }
    }
    etiquetaV[v] = mejor;
  }
  return datos.caras.map((c) => {
    const e = [etiquetaV[datos.sold.id[c[2]]], etiquetaV[datos.sold.id[c[3]]], etiquetaV[datos.sold.id[c[4]]]];
    return e[1] === e[2] ? e[1] : e[0];
  });
}

function bloques(datos, k) {
  const { sold } = datos;
  const u = sold.unicos;
  const n = sold.n;
  const centros = [];
  // k-means++ simplificado
  centros.push(Math.floor(Math.random() * n));
  const dist = new Float32Array(n).fill(Infinity);
  const d2 = (i, c) => (u[i * 3] - c[0]) ** 2 + (u[i * 3 + 1] - c[1]) ** 2 + (u[i * 3 + 2] - c[2]) ** 2;
  let C = [[u[centros[0] * 3], u[centros[0] * 3 + 1], u[centros[0] * 3 + 2]]];
  while (C.length < k) {
    let suma = 0;
    for (let i = 0; i < n; i++) { dist[i] = Math.min(dist[i], d2(i, C[C.length - 1])); suma += dist[i]; }
    let r = Math.random() * suma, elegido = 0;
    for (let i = 0; i < n; i++) { r -= dist[i]; if (r <= 0) { elegido = i; break; } }
    C.push([u[elegido * 3], u[elegido * 3 + 1], u[elegido * 3 + 2]]);
  }
  const et = new Int32Array(n);
  for (let it = 0; it < 15; it++) {
    for (let i = 0; i < n; i++) {
      let mejor = 0, dm = Infinity;
      for (let c = 0; c < k; c++) { const d = d2(i, C[c]); if (d < dm) { dm = d; mejor = c; } }
      et[i] = mejor;
    }
    const acc = C.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { const a = acc[et[i]]; a[0] += u[i * 3]; a[1] += u[i * 3 + 1]; a[2] += u[i * 3 + 2]; a[3]++; }
    C = acc.map((a, c) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : C[c]));
  }
  // Ordena los bloques de arriba abajo para que los nombres sean estables.
  const orden = C.map((c, i) => [c[1], i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const rango = new Map(orden.map((c, r) => [c, r]));
  return datos.caras.map((c) => `Bloque ${rango.get(et[sold.id[c[2]]]) + 1}`);
}

/**
 * Divide el objeto en partes.
 * @param {'piezas'|'cuerpo'|'cuadrupedo'|'bloques'} modo
 * @returns {THREE.Group} grupo con un hijo por parte (userData.parte = {nombre, color})
 */
export function segmentar(objeto, modo, { bloques: k = 6 } = {}) {
  const datos = recoger(objeto);
  let etiquetas;
  if (modo === 'piezas') etiquetas = componentes(datos);
  else if (modo === 'cuerpo') etiquetas = zonasCuerpo(datos, objeto, 'humanoide');
  else if (modo === 'cuadrupedo') etiquetas = zonasCuerpo(datos, objeto, 'cuadrupedo');
  else etiquetas = bloques(datos, k);

  // Agrupa caras por etiqueta y por malla.
  const porEtiqueta = new Map();
  datos.caras.forEach((c, i) => {
    const e = etiquetas[i];
    if (!porEtiqueta.has(e)) porEtiqueta.set(e, new Map());
    const m = porEtiqueta.get(e);
    if (!m.has(c[0])) m.set(c[0], []);
    m.get(c[0]).push(c[1]);
  });
  let lista = [...porEtiqueta.entries()].map(([e, mapa]) => ({ e, mapa, n: [...mapa.values()].reduce((s, a) => s + a.length, 0) }));
  lista.sort((a, b) => b.n - a.n);
  // Piezas sueltas: las diminutas se agrupan en «Piezas pequeñas».
  if (modo === 'piezas' && lista.length > 16) {
    const resto = lista.slice(15);
    const mapa = new Map();
    for (const r of resto) for (const [mi, cs] of r.mapa) { if (!mapa.has(mi)) mapa.set(mi, []); mapa.get(mi).push(...cs); }
    lista = [...lista.slice(0, 15), { e: 'Piezas pequeñas', mapa, n: resto.reduce((s, r) => s + r.n, 0) }];
  }
  const grupo = new THREE.Group();
  grupo.name = 'partes';
  lista.forEach((item, i) => {
    const nombre = modo === 'piezas' ? (item.e === 'Piezas pequeñas' ? item.e : `Pieza ${i + 1}`) : item.e;
    const parte = new THREE.Group();
    parte.name = nombre;
    parte.userData.parte = { nombre, color: COLORES_PARTES[i % COLORES_PARTES.length], caras: item.n };
    for (const [mi, cs] of item.mapa) {
      const g = subgeometria(datos.geos[mi], cs);
      if (!g.attributes.normal) g.computeVertexNormals();
      const m = new THREE.Mesh(g, datos.mallas[mi].material);
      m.name = `${nombre}_${mi}`;
      parte.add(m);
    }
    grupo.add(parte);
  });
  datos.geos.forEach((g) => g.dispose());
  return grupo;
}

/** Partes de un objeto segmentado (o null). */
export function partesDe(objeto) {
  const r = [];
  objeto?.traverse((o) => { if (o.userData.parte) r.push(o); });
  return r.length ? r : null;
}

/** Resalta las partes con su color (o lo quita). */
export function resaltarPartes(objeto, si) {
  for (const parte of partesDe(objeto) ?? []) {
    parte.traverse((o) => {
      if (!o.isMesh || o.userData.ayuda) return;
      if (si) {
        if (!o.userData.matSinResaltar) o.userData.matSinResaltar = o.material;
        const m = o.userData.matSinResaltar.clone();
        m.emissive = new THREE.Color(parte.userData.parte.color);
        m.emissiveIntensity = 0.45;
        o.material = m;
      } else if (o.userData.matSinResaltar) {
        o.material = o.userData.matSinResaltar;
        delete o.userData.matSinResaltar;
      }
    });
  }
}
